import { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { Author } from '../models/Author';
import { Book } from '../models/Book';
import { findOrCreateAuthor } from '../services/authors';
import { hasCapability, CAPABILITY } from '../services/rbac';

async function backfillMissingBookAuthors() {
  const books = await Book.find({
    $and: [
      {
        $or: [{ authorId: { $exists: false } }, { authorIds: { $exists: false } }, { authorIds: { $size: 0 } }],
      },
      {
        $or: [{ author: { $ne: '' } }, { authorPenName: { $ne: '' } }, { authorRealName: { $ne: '' } }],
      },
    ],
  }).limit(500);

  for (const book of books) {
    const author = await findOrCreateAuthor({
      author: book.author,
      penName: book.authorPenName || book.author,
      realName: book.authorRealName,
      alternativeNames: [],
      originalLanguage: book.rawOriginalLanguage,
      officialUrl: book.sourceUrl,
    });
    if (author) {
      book.authorId = author._id;
      book.authorIds = Array.from(new Set([...(book.authorIds || []), author._id].map((id) => id.toString()))).map(
        (id) => new mongoose.Types.ObjectId(id),
      );
      await book.save();
    }
  }
}

export async function listAuthorsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    await backfillMissingBookAuthors();
    const authors = await Author.find().sort({ displayName: 1 });
    const counts = await Book.aggregate([
      {
        $project: {
          authorRefs: {
            $setUnion: [
              { $ifNull: ['$authorIds', []] },
              {
                $cond: [{ $ifNull: ['$authorId', false] }, ['$authorId'], []],
              },
            ],
          },
        },
      },
      { $unwind: '$authorRefs' },
      { $group: { _id: '$authorRefs', bookCount: { $sum: 1 } } },
    ]);
    const countByAuthorId = new Map(counts.map((item) => [item._id.toString(), item.bookCount]));

    return reply.send(
      authors.map((author) => ({
        ...author.toObject(),
        bookCount: countByAuthorId.get(author._id.toString()) || 0,
      })),
    );
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing authors.' });
  }
}

export async function getAuthorHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid author ID.' });
  }

  try {
    const author = await Author.findById(id);
    if (!author) {
      return reply.status(404).send({ error: 'Author not found.' });
    }

    const books = await Book.find({
      $or: [{ authorIds: author._id }, { authorId: author._id }],
    }).sort({ updatedAt: -1 });
    return reply.send({
      author,
      books,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching author.' });
  }
}

function firstUrl(urls: unknown): string | undefined {
  if (Array.isArray(urls) && urls.length > 0) {
    return urls[0];
  }
  return undefined;
}

function buildUpdatePatch(body: any) {
  const { displayName, author, penName, realName, alternativeNames, originalLanguage, officialUrls, notes } = body;
  const patch = Object.fromEntries(
    Object.entries({
      displayName,
      realName,
      alternativeNames,
      originalLanguage,
      officialUrls,
      notes,
    }).filter(([, value]) => value !== undefined),
  );
  if (author !== undefined || penName !== undefined) {
    patch.penName = penName || author;
  }
  return patch;
}

async function updateAuthor(id: string, body: any, reply: FastifyReply) {
  const patch = buildUpdatePatch(body);
  const authorDoc = await Author.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
  if (!authorDoc) {
    return reply.status(404).send({ error: 'Author not found.' });
  }
  return reply.send(authorDoc);
}

async function createAuthor(body: any, reply: FastifyReply) {
  const { author, displayName, penName, realName, alternativeNames, originalLanguage, officialUrls, notes } = body;
  const fallback = author || displayName || penName;
  const created = await findOrCreateAuthor({
    author: fallback,
    penName: penName || fallback,
    realName,
    alternativeNames,
    originalLanguage,
    officialUrl: firstUrl(officialUrls),
  });
  if (!created) {
    return reply.status(400).send({ error: 'Author name is required.' });
  }
  if (notes !== undefined) {
    created.notes = notes;
    await created.save();
  }
  return reply.status(201).send(created);
}

export async function upsertAuthorHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!(await hasCapability(request, CAPABILITY.AUTHORS_MANAGE))) {
    return reply.status(403).send({ error: 'Admin access is required to manage authors.' });
  }

  const { id } = request.params as any;
  const body = request.body as any;

  try {
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      return await updateAuthor(id, body, reply);
    }
    return await createAuthor(body, reply);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error saving author.' });
  }
}

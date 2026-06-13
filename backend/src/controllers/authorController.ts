import { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { Author } from '../models/Author.js';
import { Novel } from '../models/Novel.js';
import { findOrCreateAuthor } from '../services/authors.js';
import { isAdminRequest } from '../services/permissions.js';

async function backfillMissingNovelAuthors() {
  const novels = await Novel.find({
    $and: [
      {
        $or: [
          { authorId: { $exists: false } },
          { authorIds: { $exists: false } },
          { authorIds: { $size: 0 } },
        ],
      },
      {
        $or: [
          { author: { $ne: '' } },
          { authorPenName: { $ne: '' } },
          { authorRealName: { $ne: '' } },
        ],
      },
    ],
  }).limit(500);

  for (const novel of novels) {
    const author = await findOrCreateAuthor({
      author: novel.author,
      penName: novel.authorPenName || novel.author,
      realName: novel.authorRealName,
      alternativeNames: [],
      originalLanguage: novel.rawOriginalLanguage,
      officialUrl: novel.sourceUrl,
    });
    if (author) {
      novel.authorId = author._id;
      novel.authorIds = Array.from(new Set([...(novel.authorIds || []), author._id].map((id) => id.toString())))
        .map((id) => new mongoose.Types.ObjectId(id));
      await novel.save();
    }
  }
}

export async function listAuthorsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    await backfillMissingNovelAuthors();
    const authors = await Author.find().sort({ displayName: 1 });
    const counts = await Novel.aggregate([
      {
        $project: {
          authorRefs: {
            $setUnion: [
              { $ifNull: ['$authorIds', []] },
              {
                $cond: [
                  { $ifNull: ['$authorId', false] },
                  ['$authorId'],
                  [],
                ],
              },
            ],
          },
        },
      },
      { $unwind: '$authorRefs' },
      { $group: { _id: '$authorRefs', novelCount: { $sum: 1 } } },
    ]);
    const countByAuthorId = new Map(counts.map((item) => [item._id.toString(), item.novelCount]));

    return reply.send(authors.map((author) => ({
      ...author.toObject(),
      novelCount: countByAuthorId.get(author._id.toString()) || 0,
    })));
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

    const novels = await Novel.find({
      $or: [
        { authorIds: author._id },
        { authorId: author._id },
      ],
    }).sort({ updatedAt: -1 });
    return reply.send({
      author,
      novels,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching author.' });
  }
}

export async function upsertAuthorHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!(await isAdminRequest(request))) {
    return reply.status(403).send({ error: 'Admin access is required to manage authors.' });
  }

  const { id } = request.params as any;
  const {
    displayName,
    author,
    penName,
    realName,
    alternativeNames,
    originalLanguage,
    officialUrls,
    notes,
  } = request.body as any;

  try {
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      const patch = {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(penName !== undefined || author !== undefined ? { penName: penName || author } : {}),
        ...(realName !== undefined ? { realName } : {}),
        ...(alternativeNames !== undefined ? { alternativeNames } : {}),
        ...(originalLanguage !== undefined ? { originalLanguage } : {}),
        ...(officialUrls !== undefined ? { officialUrls } : {}),
        ...(notes !== undefined ? { notes } : {}),
      };
      const authorDoc = await Author.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
      if (!authorDoc) {
        return reply.status(404).send({ error: 'Author not found.' });
      }

      return reply.send(authorDoc);
    }

    const created = await findOrCreateAuthor({
      author: author || displayName || penName,
      penName: penName || author || displayName,
      realName,
      alternativeNames,
      originalLanguage,
      officialUrl: Array.isArray(officialUrls) ? officialUrls[0] : undefined,
    });

    if (!created) {
      return reply.status(400).send({ error: 'Author name is required.' });
    }

    if (notes !== undefined) {
      created.notes = notes;
      await created.save();
    }

    return reply.status(201).send(created);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error saving author.' });
  }
}

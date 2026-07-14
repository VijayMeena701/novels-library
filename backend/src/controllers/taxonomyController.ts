import { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { Genre } from '../models/Genre';
import { PublicationStatus } from '../models/PublicationStatus';
import { Book, normalizeFilterKey } from '../models/Novel';
import { backfillBookTaxonomy } from '../services/taxonomy';
import { hasCapability, CAPABILITY } from '../services/rbac';

export async function listGenresHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    await backfillBookTaxonomy();
    const genres = await Genre.find().sort({ name: 1 });
    const counts = await Book.aggregate([
      { $unwind: '$genreIds' },
      { $group: { _id: '$genreIds', bookCount: { $sum: 1 } } },
    ]);
    const countByGenreId = new Map(counts.map((item) => [item._id.toString(), item.bookCount]));

    return reply.send(
      genres.map((genre) => ({
        ...genre.toObject(),
        bookCount: countByGenreId.get(genre._id.toString()) || 0,
      })),
    );
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing genres.' });
  }
}

export async function getGenreHandler(request: FastifyRequest, reply: FastifyReply) {
  const { keyOrId } = request.params as any;

  try {
    const genre = mongoose.Types.ObjectId.isValid(keyOrId)
      ? await Genre.findById(keyOrId)
      : await Genre.findOne({ key: normalizeFilterKey(keyOrId) });

    if (!genre) {
      return reply.status(404).send({ error: 'Genre not found.' });
    }

    const books = await Book.find({
      $or: [{ genreIds: genre._id }, { genreKeys: genre.key }],
    }).sort({ updatedAt: -1 });

    return reply.send({ genre, books });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching genre.' });
  }
}

export async function upsertGenreHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!(await hasCapability(request, CAPABILITY.GENRES_MANAGE))) {
    return reply.status(403).send({ error: 'Admin access is required to manage genres.' });
  }

  const { id } = request.params as any;
  const { name, key, aliases, description } = request.body as any;
  const patch = {
    ...(name !== undefined ? { name } : {}),
    ...(key !== undefined ? { key } : {}),
    ...(aliases !== undefined ? { aliases } : {}),
    ...(description !== undefined ? { description } : {}),
  };

  try {
    const genre =
      id && mongoose.Types.ObjectId.isValid(id)
        ? await Genre.findByIdAndUpdate(id, patch, { new: true, runValidators: true })
        : await Genre.create(patch);

    if (!genre) {
      return reply.status(404).send({ error: 'Genre not found.' });
    }

    return reply.status(id ? 200 : 201).send(genre);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error saving genre.' });
  }
}

export async function listPublicationStatusesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    await backfillBookTaxonomy();
    const statuses = await PublicationStatus.find().sort({ sortOrder: 1, name: 1 });
    const counts = await Book.aggregate([
      { $match: { publicationStatusId: { $ne: null } } },
      { $group: { _id: '$publicationStatusId', bookCount: { $sum: 1 } } },
    ]);
    const countByStatusId = new Map(counts.map((item) => [item._id.toString(), item.bookCount]));

    return reply.send(
      statuses.map((status) => ({
        ...status.toObject(),
        bookCount: countByStatusId.get(status._id.toString()) || 0,
      })),
    );
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing publication statuses.' });
  }
}

export async function getPublicationStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const { keyOrId } = request.params as any;

  try {
    const status = mongoose.Types.ObjectId.isValid(keyOrId)
      ? await PublicationStatus.findById(keyOrId)
      : await PublicationStatus.findOne({ key: normalizeFilterKey(keyOrId) });

    if (!status) {
      return reply.status(404).send({ error: 'Publication status not found.' });
    }

    const books = await Book.find({
      $or: [{ publicationStatusId: status._id }, { publicationStatusKey: status.key }],
    }).sort({ updatedAt: -1 });

    return reply.send({ status, books });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching publication status.' });
  }
}

export async function upsertPublicationStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!(await hasCapability(request, CAPABILITY.PUBLICATION_STATUSES_MANAGE))) {
    return reply.status(403).send({ error: 'Admin access is required to manage publication statuses.' });
  }

  const { id } = request.params as any;
  const { name, key, aliases, color, sortOrder } = request.body as any;
  const patch = {
    ...(name !== undefined ? { name } : {}),
    ...(key !== undefined ? { key } : {}),
    ...(aliases !== undefined ? { aliases } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(sortOrder !== undefined ? { sortOrder } : {}),
  };

  try {
    const status =
      id && mongoose.Types.ObjectId.isValid(id)
        ? await PublicationStatus.findByIdAndUpdate(id, patch, { new: true, runValidators: true })
        : await PublicationStatus.create(patch);

    if (!status) {
      return reply.status(404).send({ error: 'Publication status not found.' });
    }

    return reply.status(id ? 200 : 201).send(status);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error saving publication status.' });
  }
}

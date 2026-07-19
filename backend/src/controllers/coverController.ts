import { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { Book } from '../models/Novel';
import { createCoverImageReadStream, getCoverImageSize, syncBookCoverImage } from '../services/coverImage';
import { hasCapability, CAPABILITY } from '../services/rbac';

export async function getPublicBookCoverHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id, token } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findOne({ _id: id, coverImageToken: token });
    if (!book?.coverImagePath) {
      return reply.status(404).send({ error: 'Cover image not found.' });
    }

    const [stream, size] = await Promise.all([
      createCoverImageReadStream(book.coverImagePath),
      getCoverImageSize(book.coverImagePath),
    ]);

    return reply
      .header('Content-Type', book.coverImageMimeType || 'application/octet-stream')
      .header('Content-Length', size)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(stream);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error serving cover image.' });
  }
}

export async function syncBookCoverHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const { coverUrl } = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.COVER_SYNC))) {
      return reply.status(403).send({ error: 'Admin access is required to sync catalog cover images.' });
    }

    const book = await Book.findById(id);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const sourceUrl = coverUrl || book.coverUrl;
    if (!sourceUrl) {
      return reply.status(400).send({ error: 'No cover URL is stored for this book.' });
    }

    await syncBookCoverImage(book, sourceUrl);
    await book.save();

    return reply.send(book);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error syncing cover image.' });
  }
}

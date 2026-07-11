import { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { Novel } from '../models/Novel.js';
import {
  createCoverImageReadStream,
  getCoverImageSize,
  syncNovelCoverImage,
} from '../services/coverImage.js';
import { hasCapability, CAPABILITY } from '../services/rbac.js';

export async function getPublicNovelCoverHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id, token } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const novel = await Novel.findOne({ _id: id, coverImageToken: token });
    if (!novel || !novel.coverImagePath) {
      return reply.status(404).send({ error: 'Cover image not found.' });
    }

    const [stream, size] = await Promise.all([
      createCoverImageReadStream(novel.coverImagePath),
      getCoverImageSize(novel.coverImagePath),
    ]);

    return reply
      .header('Content-Type', novel.coverImageMimeType || 'application/octet-stream')
      .header('Content-Length', size)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(stream);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error serving cover image.' });
  }
}

export async function syncNovelCoverHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const { coverUrl } = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.COVER_SYNC))) {
      return reply.status(403).send({ error: 'Admin access is required to sync catalog cover images.' });
    }

    const novel = await Novel.findById(id);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    const sourceUrl = coverUrl || novel.coverUrl;
    if (!sourceUrl) {
      return reply.status(400).send({ error: 'No cover URL is stored for this novel.' });
    }

    await syncNovelCoverImage(novel, sourceUrl);
    await novel.save();

    return reply.send(novel);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error syncing cover image.' });
  }
}

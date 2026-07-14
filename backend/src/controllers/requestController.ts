import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { BookRequest } from '../models/BookRequest';

export async function createBookRequestHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { title, description = '' } = request.body as any;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return reply.status(400).send({ error: 'Title is required.' });
  }

  try {
    const requestDoc = await BookRequest.create({
      title: title.trim(),
      description: description.trim(),
      requestedByUserId: new mongoose.Types.ObjectId(userId),
      status: 'open',
      votes: 0,
    });
    return reply.status(201).send({ request: requestDoc });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error creating request.' });
  }
}

export async function listBookRequestsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { status, page = '1', limit = '20' } = request.query as any;

  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = {};
    if (status && ['open', 'in_progress', 'completed', 'declined'].includes(status)) {
      filter.status = status;
    }

    const [requests, total] = await Promise.all([
      BookRequest.find(filter)
        .sort({ votes: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('requestedByUserId', 'username')
        .lean(),
      BookRequest.countDocuments(filter),
    ]);

    return reply.send({
      requests,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching requests.' });
  }
}

export async function voteBookRequestHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid request ID.' });
  }

  try {
    const requestDoc = await BookRequest.findById(id);
    if (!requestDoc) {
      return reply.status(404).send({ error: 'Request not found.' });
    }

    requestDoc.votes += 1;
    await requestDoc.save();

    return reply.send({ request: requestDoc });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error voting for request.' });
  }
}

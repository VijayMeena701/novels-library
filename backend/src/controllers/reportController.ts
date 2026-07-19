import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { Report } from '../models/Report';
import { Book } from '../models/Book';
import { hasCapability, CAPABILITY } from '../services/rbac';

const VALID_REASONS = new Set(['spam', 'inappropriate_content', 'copyright', 'incorrect_metadata', 'other']);
const VALID_STATUSES = new Set(['open', 'under_review', 'resolved', 'dismissed']);

export async function createReportHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;
  const { reason, description = '' } = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }
  if (!VALID_REASONS.has(reason)) {
    return reply.status(400).send({ error: 'Invalid report reason.' });
  }

  try {
    const book = await Book.findById(id);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const report = await Report.create({
      bookId: book._id,
      reporterUserId: new mongoose.Types.ObjectId(userId as string),
      reason,
      description,
      status: 'open',
    });

    return reply.status(201).send({ report });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error creating report.' });
  }
}

export async function listReportsHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!(await hasCapability(request, CAPABILITY.BOOKS_MANAGE))) {
    return reply.status(403).send({ error: 'Admin access is required.' });
  }

  const { status, page = '1', limit = '20' } = request.query as any;
  try {
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = {};
    if (status && VALID_STATUSES.has(status)) {
      filter.status = status;
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('bookId', 'title')
        .populate('reporterUserId', 'username')
        .lean(),
      Report.countDocuments(filter),
    ]);

    return reply.send({
      reports,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching reports.' });
  }
}

export async function updateReportStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!(await hasCapability(request, CAPABILITY.BOOKS_MANAGE))) {
    return reply.status(403).send({ error: 'Admin access is required.' });
  }

  const { id } = request.params as any;
  const { status } = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid report ID.' });
  }
  if (!VALID_STATUSES.has(status)) {
    return reply.status(400).send({ error: 'Invalid report status.' });
  }

  try {
    const report = await Report.findByIdAndUpdate(id, { status }, { new: true });
    if (!report) {
      return reply.status(404).send({ error: 'Report not found.' });
    }
    return reply.send({ report });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating report.' });
  }
}

import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { BookVisit } from "../models/ChapterVisit.js";

const DEFAULT_HISTORY_LIMIT = 50;

export async function getHistoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { page = "1", limit = String(DEFAULT_HISTORY_LIMIT) } = request.query as any;

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || DEFAULT_HISTORY_LIMIT));
  const skip = (pageNumber - 1) * pageSize;

  try {
    const [visits, total] = await Promise.all([
      BookVisit.find({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ openedAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate("bookId")
        .lean(),
      BookVisit.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
    ]);

    return reply.send({
      visits,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: "Server error loading reading history." });
  }
}

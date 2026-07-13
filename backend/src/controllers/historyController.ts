import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { ChapterVisit } from "../models/ChapterVisit.js";
import { UserBook } from "../models/UserNovel.js";

const DEFAULT_HISTORY_LIMIT = 50;

const PERSONAL_LIBRARY_FIELDS = [
	"status",
	"chaptersRead",
	"rating",
	"review",
	"personalNotes",
	"rawLegacyEntry",
	"characterNotes",
	"relationshipNotes",
	"personalTags",
	"completedAt",
	"lastVisitedChapterNumber",
	"lastVisitedAt",
] as const;

export async function getHistoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { page = "1", limit = String(DEFAULT_HISTORY_LIMIT) } = request.query as any;

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || DEFAULT_HISTORY_LIMIT));
  const skip = (pageNumber - 1) * pageSize;

  try {
    const [visits, total] = await Promise.all([
      ChapterVisit.find({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ openedAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate("bookId")
        .lean(),
      ChapterVisit.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
    ]);

    const bookIds = visits
      .map((visit: any) => visit.bookId?._id)
      .filter((id: any) => id && mongoose.Types.ObjectId.isValid(id));
    const userBooks = await UserBook.find({
      userId: new mongoose.Types.ObjectId(userId),
      bookId: { $in: bookIds },
    }).lean();
    const userBookByBookId = new Map(userBooks.map((userBook) => [userBook.bookId.toString(), userBook]));

    for (const visit of visits as any[]) {
      const book = visit.bookId;
      if (!book || typeof book !== "object") continue;

      const userBook = userBookByBookId.get(book._id?.toString());
      if (userBook) {
        for (const field of PERSONAL_LIBRARY_FIELDS) {
          if (userBook[field] !== undefined) {
            book[field] = userBook[field];
          }
        }
      } else {
        book.status = book.status ?? "planning";
        book.chaptersRead = book.chaptersRead ?? 0;
      }
    }

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

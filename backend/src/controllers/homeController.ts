import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { Book } from '../models/Novel';
import { UserBook } from '../models/UserNovel';
import { BookStats } from '../models/BookStats';
import { BookActivity } from '../models/BookActivity';

const HOME_LIMIT = 6;
const ACTIVITY_LIMIT = 10;

export async function getHomeHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any)?.id;

  try {
    const [totalBooks, totalChapters] = await Promise.all([
      Book.countDocuments(),
      Book.aggregate([{ $group: { _id: null, total: { $sum: '$translatedChaptersTotal' } } }]).then(
        (res) => res[0]?.total || 0,
      ),
    ]);

    const recentlyUpdated = await Book.find().sort({ updatedAt: -1 }).limit(HOME_LIMIT).lean();

    const topRatedStats = await BookStats.find({ ratingCount: { $gt: 0 } })
      .sort({ ratingAverage: -1, ratingCount: -1 })
      .limit(HOME_LIMIT)
      .populate('bookId')
      .lean();

    const mostVisitedStats = await BookStats.find({ totalVisits: { $gt: 0 } })
      .sort({ totalVisits: -1 })
      .limit(HOME_LIMIT)
      .populate('bookId')
      .lean();

    const topVotedStats = await BookStats.find({ totalVotes: { $gt: 0 } })
      .sort({ totalVotes: -1, ratingAverage: -1 })
      .limit(HOME_LIMIT)
      .populate('bookId')
      .lean();

    const personal: any = {};
    let activities: any[] = [];
    let continueReading: any[] = [];

    if (userId) {
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const userStats = await UserBook.aggregate([
        { $match: { userId: userObjectId } },
        {
          $group: {
            _id: null,
            reading: { $sum: { $cond: [{ $eq: ['$status', 'reading'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            planning: { $sum: { $cond: [{ $eq: ['$status', 'planning'] }, 1, 0] } },
            onHold: { $sum: { $cond: [{ $eq: ['$status', 'on_hold'] }, 1, 0] } },
            dropped: { $sum: { $cond: [{ $eq: ['$status', 'dropped'] }, 1, 0] } },
            totalChaptersRead: { $sum: '$chaptersRead' },
          },
        },
      ]);

      personal.library = userStats[0] || {
        reading: 0,
        completed: 0,
        planning: 0,
        onHold: 0,
        dropped: 0,
        totalChaptersRead: 0,
      };

      const continueReadingEntries = await UserBook.find({
        userId: userObjectId,
        status: { $in: ['reading', 'on_hold'] },
      })
        .sort({ lastVisitedAt: -1, updatedAt: -1 })
        .limit(HOME_LIMIT)
        .populate('bookId')
        .lean();

      continueReading = continueReadingEntries.map((item: any) => ({
        ...(item.bookId),
        status: item.status,
        chaptersRead: item.chaptersRead,
        rating: item.rating,
        lastVisitedChapterNumber: item.lastVisitedChapterNumber,
        lastVisitedAt: item.lastVisitedAt,
      }));

      activities = await BookActivity.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .limit(ACTIVITY_LIMIT)
        .populate('bookId')
        .lean();
    }

    const topRated = topRatedStats.map((stat: any) => ({
      ...stat.bookId,
      ratingAverage: stat.ratingAverage,
      ratingCount: stat.ratingCount,
      rating: stat.ratingAverage,
    }));

    const mostVisited = mostVisitedStats.map((stat: any) => ({
      ...stat.bookId,
      totalVisits: stat.totalVisits,
    }));

    const topVoted = topVotedStats.map((stat: any) => ({
      ...stat.bookId,
      totalVotes: stat.totalVotes,
      ratingAverage: stat.ratingAverage,
    }));

    return reply.send({
      stats: {
        totalBooks,
        totalChapters,
      },
      personal,
      recentlyUpdated,
      topRated,
      mostVisited,
      topVoted,
      continueReading,
      activities,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error loading home data.' });
  }
}

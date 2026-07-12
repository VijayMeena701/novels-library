import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { Book, BookStatus, normalizeFilterKey } from '../models/Novel.js';
import { ReadingSession } from '../models/ReadingSession.js';
import { BookContent } from '../models/ChapterContent.js';
import { RawBookContent } from '../models/RawChapterContent.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { BookVisit } from '../models/ChapterVisit.js';
import { UserBook } from '../models/UserNovel.js';
import { BookStats } from '../models/BookStats.js';
import { BookActivity } from '../models/BookActivity.js';
import { Notification } from '../models/Notification.js';
import { deleteCoverImageFile } from '../services/coverImage.js';
import { resolveAuthorIds, toAuthorObjectId, toAuthorObjectIds } from '../services/authors.js';
import { resolveGenres, resolvePublicationStatus } from '../services/taxonomy.js';
import { hasCapability, CAPABILITY } from '../services/rbac.js';

const VALID_BOOK_STATUSES = new Set<BookStatus>(['reading', 'completed', 'on_hold', 'dropped', 'planning']);

const PERSONAL_LIBRARY_FIELDS = [
  'status',
  'unitsRead',
  'rating',
  'review',
  'personalNotes',
  'rawLegacyEntry',
  'characterNotes',
  'relationshipNotes',
  'personalTags',
  'completedAt',
  'lastVisitedUnitNumber',
  'lastVisitedAt',
];

const SHARED_BOOK_FIELDS = [
  'title',
  'authorId',
  'authorIds',
  'author',
  'authorPenName',
  'authorRealName',
  'alternativeNames',
  'genreIds',
  'genres',
  'originalSource',
  'publicationStatusId',
  'publicationStatus',
  'description',
  'coverUrl',
  'sourceUrl',
  'rawSourceUrl',
  'rawOriginalLanguage',
];

function pickPersonalLibraryUpdates(updates: Record<string, any>) {
  const picked: Record<string, any> = {};
  for (const field of PERSONAL_LIBRARY_FIELDS) {
    if (updates[field] !== undefined) {
      picked[field] = updates[field];
    }
  }
  return picked;
}

function pickSharedBookUpdates(updates: Record<string, any>) {
  const picked: Record<string, any> = {};
  for (const field of SHARED_BOOK_FIELDS) {
    if (updates[field] !== undefined) {
      picked[field] = updates[field];
    }
  }
  return picked;
}

function serializeBookForUser(book: any, userBook?: any) {
  const serialized = typeof book.toObject === 'function' ? book.toObject() : { ...book };
  if (!serialized.authorId && Array.isArray(serialized.authorIds) && serialized.authorIds.length > 0) {
    serialized.authorId = serialized.authorIds[0];
  }
  if (!userBook) {
    return serialized;
  }

  const personal = typeof userBook.toObject === 'function' ? userBook.toObject() : userBook;
  for (const field of PERSONAL_LIBRARY_FIELDS) {
    if (personal[field] !== undefined) {
      serialized[field] = personal[field];
    }
  }

  serialized.userBookId = personal._id;
  serialized.userBookCreatedAt = personal.createdAt;
  serialized.userBookUpdatedAt = personal.updatedAt;
  return serialized;
}

function toFilterKeys(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => normalizeFilterKey(item))
    .filter(Boolean);
}

function toObjectIds(value: unknown): mongoose.Types.ObjectId[] {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseNumber(value: unknown, fallback?: number, min?: number, max?: number): number | undefined {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  let result = parsed;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  return result;
}

function pushFilter(andFilters: any[], condition: Record<string, any>) {
  if (Object.keys(condition).length > 0) {
    andFilters.push(condition);
  }
}

function applySharedBookFilters(andFilters: any[], query: Record<string, any>) {
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
  if (search) {
    const escaped = escapeRegex(search);
    const regex = new RegExp(escaped, 'i');
    pushFilter(andFilters, {
      $or: [
        { title: regex },
        { author: regex },
        { authorPenName: regex },
        { authorRealName: regex },
        { alternativeNames: regex },
      ],
    });
  }

  const genreIds = toObjectIds(query.genreId);
  const genreKeys = toFilterKeys(query.genre);
  if (genreIds.length > 0) {
    pushFilter(andFilters, { genreIds: { $in: genreIds } });
  } else if (genreKeys.length > 0) {
    pushFilter(andFilters, { genreKeys: { $in: genreKeys } });
  }

  const sourceKeys = toFilterKeys(query.source);
  if (sourceKeys.length > 0) {
    pushFilter(andFilters, { originalSourceKey: { $in: sourceKeys } });
  }

  const publicationStatusId = typeof query.publicationStatusId === 'string' && mongoose.Types.ObjectId.isValid(query.publicationStatusId)
    ? new mongoose.Types.ObjectId(query.publicationStatusId)
    : undefined;
  const publicationStatusKeys = toFilterKeys(query.publicationStatus || query.catalogStatus);
  if (publicationStatusId) {
    pushFilter(andFilters, { publicationStatusId });
  } else if (publicationStatusKeys.length > 0) {
    pushFilter(andFilters, { publicationStatusKey: { $in: publicationStatusKeys } });
  }

  const statusValues = typeof query.status === 'string'
    ? query.status.split(',').map((s: string) => s.trim()).filter((s: string) => VALID_BOOK_STATUSES.has(s as BookStatus))
    : [];
  if (statusValues.length > 0) {
    pushFilter(andFilters, { status: { $in: statusValues } });
  }

  const authorIds = toObjectIds(query.authorId);
  if (authorIds.length > 0) {
    pushFilter(andFilters, {
      $or: [
        { authorIds: { $in: authorIds } },
        { authorId: { $in: authorIds } },
      ],
    });
  }

  const ratingFilter: Record<string, number> = {};
  const minRating = parseNumber(query.minRating, undefined);
  const maxRating = parseNumber(query.maxRating, undefined);
  if (minRating !== undefined) ratingFilter.$gte = minRating;
  if (maxRating !== undefined) ratingFilter.$lte = maxRating;
  if (Object.keys(ratingFilter).length > 0) {
    pushFilter(andFilters, { rating: ratingFilter });
  }
}

async function applySharedBookUpdates(book: any, updates: Record<string, any>) {
  if (updates.title !== undefined) book.title = String(updates.title || '').trim() || book.title;
  if (updates.author !== undefined) book.author = String(updates.author || '').trim();
  if (updates.authorPenName !== undefined) book.authorPenName = String(updates.authorPenName || '').trim();
  if (updates.authorRealName !== undefined) book.authorRealName = String(updates.authorRealName || '').trim();
  if (updates.alternativeNames !== undefined) {
    book.alternativeNames = Array.isArray(updates.alternativeNames) ? updates.alternativeNames : [];
  }
  if (updates.originalSource !== undefined) book.originalSource = String(updates.originalSource || '').trim();
  if (updates.description !== undefined) book.description = String(updates.description || '').trim();
  if (updates.coverUrl !== undefined) book.coverUrl = String(updates.coverUrl || '').trim();
  if (updates.sourceUrl !== undefined) book.sourceUrl = String(updates.sourceUrl || '').trim();
  if (updates.rawSourceUrl !== undefined) book.rawSourceUrl = String(updates.rawSourceUrl || '').trim();
  if (updates.rawOriginalLanguage !== undefined) book.rawOriginalLanguage = String(updates.rawOriginalLanguage || '').trim();

  if (
    updates.authorIds !== undefined ||
    updates.authorId !== undefined ||
    updates.author !== undefined ||
    updates.authorPenName !== undefined ||
    updates.authorRealName !== undefined
  ) {
    const authorIds = await resolveAuthorIds({
      authorIds: updates.authorIds,
      authorId: updates.authorId,
      author: updates.author ?? book.author,
      penName: updates.authorPenName ?? updates.author ?? book.authorPenName,
      realName: updates.authorRealName ?? book.authorRealName,
      alternativeNames: updates.alternativeNames ?? book.alternativeNames,
      originalLanguage: updates.rawOriginalLanguage ?? book.rawOriginalLanguage,
      officialUrl: updates.sourceUrl ?? book.sourceUrl,
    });
    if (authorIds.length > 0) {
      book.authorIds = authorIds;
      book.authorId = authorIds[0];
    }
  }

  if (updates.genreIds !== undefined || updates.genres !== undefined) {
    const resolvedGenres = await resolveGenres({
      genreIds: updates.genreIds,
      genres: updates.genres,
    });
    book.genreIds = resolvedGenres.genreIds;
    book.genres = resolvedGenres.genres;
    book.genreKeys = resolvedGenres.genreKeys;
  }

  if (updates.publicationStatusId !== undefined || updates.publicationStatus !== undefined) {
    const resolvedStatus = await resolvePublicationStatus({
      publicationStatusId: updates.publicationStatusId,
      publicationStatus: updates.publicationStatus,
    });
    if (resolvedStatus.publicationStatusId) {
      book.publicationStatusId = resolvedStatus.publicationStatusId;
      book.publicationStatus = resolvedStatus.publicationStatus || '';
      book.publicationStatusKey = resolvedStatus.publicationStatusKey || '';
    } else if (updates.publicationStatus === '') {
      book.publicationStatusId = undefined;
      book.publicationStatus = '';
      book.publicationStatusKey = '';
    }
  }
}

export async function listBooksHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { status } = request.query as any;

  try {
    const userBookFilter: Record<string, any> = { userId };
    if (typeof status === 'string' && status !== 'all' && VALID_BOOK_STATUSES.has(status as BookStatus)) {
      userBookFilter.status = status;
    }

    const userBooks = await UserBook.find(userBookFilter).sort({ updatedAt: -1 });
    const userBookByBookId = new Map(userBooks.map((item) => [item.bookId.toString(), item]));

    const filter: Record<string, any> = {
      _id: { $in: userBooks.map((item) => item.bookId) },
    };
    const andFilters: any[] = [filter];
    applySharedBookFilters(andFilters, { ...(request.query as any), status: undefined });
    const bookFilter = andFilters.length > 1 ? { $and: andFilters } : filter;

    const books = await Book.find(bookFilter);
    const bookById = new Map(books.map((book) => [book._id.toString(), book]));
    const serialized = userBooks
      .map((userBook) => {
        const book = bookById.get(userBook.bookId.toString());
        return book ? serializeBookForUser(book, userBook) : null;
      })
      .filter(Boolean);

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing books.' });
  }
}

export async function listCatalogBooksHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as any;
    const andFilters: any[] = [];
    applySharedBookFilters(andFilters, query);
    const filter = andFilters.length > 0 ? { $and: andFilters } : {};

    const allowedSortFields = ['updatedAt', 'title', 'translatedUnitsTotal', 'rawUnitsTotal', 'rating', 'publicationStatus', 'createdAt', 'author', 'originalSource'];
    const sortField = (allowedSortFields.includes(query.sort) ? query.sort : 'updatedAt') as string;
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const sort: Record<string, 1 | -1> = { [sortField]: sortDir === 'asc' ? 1 : -1 };

    const page = parseNumber(query.page, query.pageSize ? 1 : undefined, 1);

    if (page !== undefined) {
      const pageSize = parseNumber(query.pageSize, 24, 1, 100) ?? 24;
      const skip = (page - 1) * pageSize;

      const [books, total] = await Promise.all([
        Book.find(filter).sort(sort).skip(skip).limit(pageSize).lean(),
        Book.countDocuments(filter),
      ]);

      return reply.send({
        books,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      });
    }

    const books = await Book.find(filter).sort(sort).lean();
    return reply.send(books);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing catalog books.' });
  }
}

export async function listBookSourcesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const sources = await Book.aggregate([
      { $match: { originalSourceKey: { $ne: '' } } },
      { $group: { _id: '$originalSourceKey', originalSource: { $first: '$originalSource' }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);

    return reply.send(sources.map((source) => ({ key: source._id, name: source.originalSource, count: source.count })));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing book sources.' });
  }
}

export async function getCatalogBookHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(id);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const [bookStats, userVote] = await Promise.all([
      BookStats.findOne({ bookId: book._id }).lean(),
      (request.user as any)?.id
        ? BookActivity.findOne({
            bookId: book._id,
            userId: new mongoose.Types.ObjectId((request.user as any).id),
            activityType: 'vote',
          }).lean()
        : Promise.resolve(null),
    ]);

    return reply.send({
      ...book.toObject(),
      ratingAverage: bookStats?.ratingAverage || 0,
      ratingCount: bookStats?.ratingCount || 0,
      reviewCount: bookStats?.reviewCount || 0,
      totalVisits: bookStats?.totalVisits || 0,
      totalVotes: bookStats?.totalVotes || 0,
      userVoted: Boolean(userVote),
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching catalog book.' });
  }
}

export async function createBookHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const {
    title,
    authorId,
    authorIds,
    author,
    authorPenName,
    authorRealName,
    alternativeNames,
    genreIds,
    genres,
    originalSource,
    publicationStatusId,
    publicationStatus,
    description,
    coverUrl,
    sourceUrl,
    rawSourceUrl,
    rawOriginalLanguage,
  } = request.body as any;

  try {
    if (!(await hasCapability(request, CAPABILITY.BOOKS_MANAGE))) {
      return reply.status(403).send({ error: 'Admin access is required to create catalog books.' });
    }

    // If no title is given, but URL is provided, we can assign a placeholder that updates on scrape
    const finalTitle = title || (sourceUrl ? 'Pending Scrape' : 'Untitled Book');
    const linkedAuthorIds = await resolveAuthorIds({
      authorId,
      authorIds,
      author,
      penName: authorPenName || author,
      realName: authorRealName,
      alternativeNames,
      originalLanguage: rawOriginalLanguage,
      officialUrl: sourceUrl,
    });
    const resolvedGenres = await resolveGenres({ genreIds, genres });
    const resolvedPublicationStatus = await resolvePublicationStatus({ publicationStatusId, publicationStatus });

    const book = await Book.create({
      addedByUserId: new mongoose.Types.ObjectId(userId),
      authorId: linkedAuthorIds[0],
      authorIds: linkedAuthorIds,
      title: finalTitle,
      author: author || '',
      authorPenName: authorPenName || '',
      authorRealName: authorRealName || '',
      alternativeNames: Array.isArray(alternativeNames) ? alternativeNames : [],
      genreIds: resolvedGenres.genreIds,
      genres: resolvedGenres.genres,
      genreKeys: resolvedGenres.genreKeys,
      originalSource: originalSource || '',
      publicationStatusId: resolvedPublicationStatus.publicationStatusId,
      publicationStatus: resolvedPublicationStatus.publicationStatus || '',
      publicationStatusKey: resolvedPublicationStatus.publicationStatusKey || '',
      description: description || '',
      coverUrl: coverUrl || '',
      sourceUrl: sourceUrl || '',
      rawSourceUrl: rawSourceUrl || '',
      rawOriginalLanguage: rawOriginalLanguage || '',
      translatedUnitsList: []
    });

    // If sourceUrl is provided, trigger a background metadata job
    if (sourceUrl) {
      await BackgroundJob.create({
        bookId: book._id,
        userId: new mongoose.Types.ObjectId(userId),
        type: 'scrape_metadata',
        status: 'pending',
      });
    }

    return reply.status(201).send(book);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error creating book.' });
  }
}

export async function addBookToLibraryHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(id);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const userBook = await UserBook.findOneAndUpdate(
      { userId, bookId: book._id },
      {
        $setOnInsert: {
          status: 'planning',
          unitsRead: 0,
          rating: 0,
          review: '',
          personalNotes: '',
          rawLegacyEntry: '',
          characterNotes: '',
          relationshipNotes: '',
          personalTags: [],
        },
      },
      { new: true, upsert: true }
    );

    return reply.status(201).send(serializeBookForUser(book, userBook));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error adding book to library.' });
  }
}

export async function getBookHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(id);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const userBook = await UserBook.findOne({ bookId: id, userId });
    if (!userBook) {
      return reply.status(404).send({ error: 'Book not found in your library.' });
    }
    const serialized = serializeBookForUser(book, userBook);
    const [bookStats, userVote] = await Promise.all([
      BookStats.findOne({ bookId: book._id }).lean(),
      BookActivity.findOne({
        bookId: book._id,
        userId: new mongoose.Types.ObjectId(userId),
        activityType: 'vote',
      }).lean(),
    ]);
    return reply.send({
      ...serialized,
      ratingAverage: bookStats?.ratingAverage || 0,
      ratingCount: bookStats?.ratingCount || 0,
      reviewCount: bookStats?.reviewCount || 0,
      totalVisits: bookStats?.totalVisits || 0,
      totalVotes: bookStats?.totalVotes || 0,
      userVoted: Boolean(userVote),
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching book.' });
  }
}

export async function updateBookHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;
  const updates = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    // We restrict system-maintained fields to prevent privilege escalation and key drift.
    delete updates.userId;
    delete updates.addedByUserId;
    delete updates._id;
    delete updates.genreKeys;
    delete updates.personalTagKeys;
    delete updates.originalSourceKey;
    delete updates.publicationStatusKey;
    delete updates.coverImagePath;
    delete updates.coverImageMimeType;
    delete updates.coverImageSize;
    delete updates.coverImageToken;
    delete updates.coverImageSyncedAt;
    delete updates.createdAt;
    delete updates.updatedAt;
    if (updates.authorId !== undefined && !toAuthorObjectId(updates.authorId)) {
      delete updates.authorId;
    }
    if (updates.authorIds !== undefined && toAuthorObjectIds(updates.authorIds).length === 0) {
      delete updates.authorIds;
    }

    const book = await Book.findById(id);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found or unauthorized.' });
    }

    const userBook = await UserBook.findOne({ bookId: id, userId });
    if (!userBook) {
      return reply.status(404).send({ error: 'Book not found in your library.' });
    }

    const isAdmin = await hasCapability(request, CAPABILITY.BOOKS_MANAGE);
    const personalUpdates = pickPersonalLibraryUpdates(updates);
    const sharedUpdates = pickSharedBookUpdates(updates);

    const oldRating = Number(userBook.rating) || 0;
    const oldReview = String(userBook.review || '');
    const newRating = updates.rating !== undefined ? Number(updates.rating) || 0 : oldRating;
    const newReview = updates.review !== undefined ? String(updates.review || '') : oldReview;

    const nextCoverUrl = typeof updates.coverUrl === 'string' ? updates.coverUrl.trim() : undefined;
    if (isAdmin && nextCoverUrl !== undefined && nextCoverUrl !== book.coverUrl) {
      await deleteCoverImageFile(book.coverImagePath);
      book.coverImagePath = '';
      book.coverImageMimeType = '';
      book.coverImageSize = 0;
      book.coverImageToken = '';
      book.coverImageSyncedAt = undefined;
    }

    Object.assign(userBook, personalUpdates);

    if (isAdmin && Object.keys(sharedUpdates).length > 0) {
      await applySharedBookUpdates(book, sharedUpdates);
    }

    // Auto-mark completed if unitsRead matches translatedUnitsTotal and translatedUnitsTotal > 0
    if (book.translatedUnitsTotal > 0 && userBook.unitsRead >= book.translatedUnitsTotal && userBook.status !== 'completed') {
      userBook.status = 'completed';
    }

    if (userBook.status === 'completed' && !userBook.completedAt) {
      userBook.completedAt = new Date();
    }

    await userBook.save();
    if (isAdmin && Object.keys(sharedUpdates).length > 0) {
      await book.save();
    }

    await syncBookStatsAndActivities(book, userId, oldRating, newRating, oldReview, newReview);

    return reply.send(serializeBookForUser(book, userBook));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating book.' });
  }
}

async function syncBookStatsAndActivities(
  book: any,
  userId: string,
  oldRating: number,
  newRating: number,
  oldReview: string,
  newReview: string
) {
  const bookId = book._id;
  let bookStats = await BookStats.findOne({ bookId });
  if (!bookStats) {
    bookStats = new BookStats({ bookId });
  }

  const oldRatingNum = Number(oldRating) || 0;
  const newRatingNum = Number(newRating) || 0;

  if (oldRatingNum !== newRatingNum) {
    if (oldRatingNum > 0 && newRatingNum > 0) {
      bookStats.ratingSum += newRatingNum - oldRatingNum;
    } else if (oldRatingNum === 0 && newRatingNum > 0) {
      bookStats.ratingCount += 1;
      bookStats.ratingSum += newRatingNum;
    } else if (oldRatingNum > 0 && newRatingNum === 0) {
      bookStats.ratingCount -= 1;
      bookStats.ratingSum -= oldRatingNum;
    }
    if (bookStats.ratingCount < 0) bookStats.ratingCount = 0;
    if (bookStats.ratingSum < 0) bookStats.ratingSum = 0;
  }

  const oldHasReview = Boolean(oldReview?.trim());
  const newHasReview = typeof newReview === 'string' && newReview.trim().length > 0;
  if (oldHasReview !== newHasReview) {
    if (newHasReview) bookStats.reviewCount += 1;
    else bookStats.reviewCount -= 1;
    if (bookStats.reviewCount < 0) bookStats.reviewCount = 0;
  }

  await bookStats.save();

  const activities: Promise<any>[] = [];
  if (oldRatingNum !== newRatingNum) {
    activities.push(BookActivity.create({
      bookId,
      userId: new mongoose.Types.ObjectId(userId),
      activityType: 'rate',
      metadata: { rating: newRatingNum },
    }));
  }
  if (oldReview !== newReview && newHasReview) {
    activities.push(BookActivity.create({
      bookId,
      userId: new mongoose.Types.ObjectId(userId),
      activityType: 'review',
      metadata: { review: newReview },
    }));
  }

  if (activities.length > 0) {
    await Promise.all(activities);
  }

  if (oldReview !== newReview && newHasReview) {
    const ownerId = book.addedByUserId;
    if (ownerId && ownerId.toString() !== userId) {
      await Notification.create({
        userId: ownerId,
        type: 'review_received',
        title: `New review on "${book.title || 'Untitled'}"`,
        message: newReview.slice(0, 200),
        link: `/books/${bookId}`,
      });
    }
  }
}

export async function getBookReviewsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const { limit = '20', page = '1' } = request.query as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      BookActivity.find({ bookId: id, activityType: 'review' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'username')
        .lean(),
      BookActivity.countDocuments({ bookId: id, activityType: 'review' }),
    ]);

    return reply.send({
      reviews: reviews.map((r: any) => ({
        _id: r._id,
        userId: r.userId?._id || r.userId,
        username: r.userId?.username || 'Unknown',
        review: r.metadata?.review || '',
        createdAt: r.createdAt,
      })),
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching reviews.' });
  }
}

export async function voteBookHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(id);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const existingVote = await BookActivity.findOne({ bookId: id, userId: new mongoose.Types.ObjectId(userId), activityType: 'vote' });
    let bookStats = await BookStats.findOne({ bookId: book._id });
    if (!bookStats) {
      bookStats = new BookStats({ bookId: book._id });
    }

    if (existingVote) {
      await existingVote.deleteOne();
      bookStats.totalVotes = Math.max(0, bookStats.totalVotes - 1);
      await bookStats.save();
      return reply.send({ voted: false, totalVotes: bookStats.totalVotes });
    }

    await BookActivity.create({
      bookId: book._id,
      userId: new mongoose.Types.ObjectId(userId),
      activityType: 'vote',
    });
    bookStats.totalVotes += 1;
    await bookStats.save();

    const ownerId = book.addedByUserId;
    if (ownerId && ownerId.toString() !== userId) {
      await Notification.create({
        userId: ownerId,
        type: 'vote_received',
        title: `New vote on "${book.title || 'Untitled'}"`,
        message: `Your book received a new vote. Total votes: ${bookStats.totalVotes}`,
        link: `/books/${book._id}`,
      });
    }

    return reply.send({ voted: true, totalVotes: bookStats.totalVotes });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error voting for book.' });
  }
}

export async function updateCatalogBookHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!(await hasCapability(request, CAPABILITY.BOOKS_MANAGE))) {
    return reply.status(403).send({ error: 'Admin access is required to edit catalog book metadata.' });
  }

  const { id } = request.params as any;
  const updates = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(id);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const sharedUpdates = pickSharedBookUpdates(updates);
    const nextCoverUrl = typeof sharedUpdates.coverUrl === 'string' ? sharedUpdates.coverUrl.trim() : undefined;
    if (nextCoverUrl !== undefined && nextCoverUrl !== book.coverUrl) {
      await deleteCoverImageFile(book.coverImagePath);
      book.coverImagePath = '';
      book.coverImageMimeType = '';
      book.coverImageSize = 0;
      book.coverImageToken = '';
      book.coverImageSyncedAt = undefined;
    }

    await applySharedBookUpdates(book, sharedUpdates);
    await book.save();

    return reply.send(book);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating catalog book.' });
  }
}

export async function deleteBookHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(id);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const userBook = await UserBook.findOne({ bookId: id, userId });
    if (!userBook) {
      return reply.status(404).send({ error: 'Book not found in your library.' });
    }

    await UserBook.deleteOne({ _id: userBook._id });
    await ReadingSession.deleteMany({ bookId: id, userId });
    await BookVisit.deleteMany({ bookId: id, userId });

    return reply.send({ success: true, message: 'Book removed from your library.' });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error deleting book.' });
  }
}

export async function deleteCatalogBookHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!(await hasCapability(request, CAPABILITY.BOOKS_DELETE))) {
    return reply.status(403).send({ error: 'Admin access is required to delete catalog books.' });
  }

  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(id);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    await UserBook.deleteMany({ bookId: id });
    await ReadingSession.deleteMany({ bookId: id });
    await BookVisit.deleteMany({ bookId: id });
    await BookContent.deleteMany({ bookId: id });
    await RawBookContent.deleteMany({ bookId: id });
    await BackgroundJob.deleteMany({ bookId: id });
    await deleteCoverImageFile(book.coverImagePath);
    await Book.deleteOne({ _id: id });

    return reply.send({ success: true, message: 'Catalog book and related archive data deleted.' });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error deleting catalog book.' });
  }
}

// Re-read Log Controllers
export async function listReadingSessionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId } = request.params as any;

  try {
    const sessions = await ReadingSession.find({ bookId, userId }).sort({ startDate: -1 });
    return reply.send(sessions);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing reading sessions.' });
  }
}

export async function startReadingSessionHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId } = request.params as any;
  const { notes, unitsRead } = request.body as any;

  try {
    const [book, userBook] = await Promise.all([
      Book.findById(bookId),
      UserBook.findOne({ bookId, userId }),
    ]);
    if (!book || !userBook) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    // Create session
    const session = await ReadingSession.create({
      bookId: book._id,
      userId: new mongoose.Types.ObjectId(userId),
      startDate: new Date(),
      notes: notes || 'Started re-reading.',
      unitsRead: unitsRead || 0,
      completed: false
    });

    return reply.status(201).send(session);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error starting reading session.' });
  }
}

export async function updateReadingSessionHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId, sessionId } = request.params as any;
  const { notes, unitsRead, completed } = request.body as any;

  try {
    const session = await ReadingSession.findOne({ _id: sessionId, bookId, userId });
    if (!session) {
      return reply.status(404).send({ error: 'Reading session not found.' });
    }

    if (unitsRead !== undefined) session.unitsRead = unitsRead;
    if (notes !== undefined) session.notes = notes;
    
    if (completed !== undefined) {
      session.completed = completed;
      if (completed) {
        session.endDate = new Date();
      } else {
        session.endDate = undefined;
      }
    }

    await session.save();
    return reply.send(session);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating reading session.' });
  }
}

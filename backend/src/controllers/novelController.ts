import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { Novel, NovelStatus, normalizeFilterKey } from '../models/Novel.js';
import { ReadingSession } from '../models/ReadingSession.js';
import { ChapterContent } from '../models/ChapterContent.js';
import { RawChapterContent } from '../models/RawChapterContent.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { ChapterVisit } from '../models/ChapterVisit.js';
import { UserNovel } from '../models/UserNovel.js';
import { deleteCoverImageFile } from '../services/coverImage.js';
import { resolveAuthorIds, toAuthorObjectId, toAuthorObjectIds } from '../services/authors.js';
import { resolveGenres, resolvePublicationStatus } from '../services/taxonomy.js';
import { isAdminRequest } from '../services/permissions.js';

const VALID_NOVEL_STATUSES = new Set<NovelStatus>(['reading', 'completed', 'on_hold', 'dropped', 'planning']);

async function syncUserNovelFromLegacyNovel(novel: any) {
  const ownerId = novel?.addedByUserId || novel?.userId;
  if (!ownerId || !novel?._id) return;

  await UserNovel.updateOne(
    { userId: ownerId, novelId: novel._id },
    {
      $set: {
        status: novel.status || 'planning',
        chaptersRead: novel.chaptersRead || 0,
        rating: novel.rating || 0,
        review: novel.review || '',
        personalNotes: novel.personalNotes || '',
        rawLegacyEntry: novel.rawLegacyEntry || '',
        characterNotes: novel.characterNotes || '',
        relationshipNotes: novel.relationshipNotes || '',
        personalTags: Array.isArray(novel.personalTags) ? novel.personalTags : [],
        completedAt: novel.completedAt,
      },
    },
    { upsert: true }
  );
}

const PERSONAL_LIBRARY_FIELDS = [
  'status',
  'chaptersRead',
  'rating',
  'review',
  'personalNotes',
  'rawLegacyEntry',
  'characterNotes',
  'relationshipNotes',
  'personalTags',
  'completedAt',
];

const SHARED_NOVEL_FIELDS = [
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

function pickSharedNovelUpdates(updates: Record<string, any>) {
  const picked: Record<string, any> = {};
  for (const field of SHARED_NOVEL_FIELDS) {
    if (updates[field] !== undefined) {
      picked[field] = updates[field];
    }
  }
  return picked;
}

function serializeNovelForUser(novel: any, userNovel?: any) {
  const serialized = typeof novel.toObject === 'function' ? novel.toObject() : { ...novel };
  if (!serialized.authorId && Array.isArray(serialized.authorIds) && serialized.authorIds.length > 0) {
    serialized.authorId = serialized.authorIds[0];
  }
  if (!userNovel) {
    return serialized;
  }

  const personal = typeof userNovel.toObject === 'function' ? userNovel.toObject() : userNovel;
  for (const field of PERSONAL_LIBRARY_FIELDS) {
    if (personal[field] !== undefined) {
      serialized[field] = personal[field];
    }
  }

  serialized.userNovelId = personal._id;
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

function pushFilter(andFilters: any[], condition: Record<string, any>) {
  if (Object.keys(condition).length > 0) {
    andFilters.push(condition);
  }
}

function applySharedNovelFilters(andFilters: any[], query: Record<string, any>) {
  const genreIds = typeof query.genreId === 'string' && mongoose.Types.ObjectId.isValid(query.genreId)
    ? [new mongoose.Types.ObjectId(query.genreId)]
    : [];
  const genreKeys = toFilterKeys(query.genre);
  if (genreIds.length > 0) {
    pushFilter(andFilters, { genreIds: { $in: genreIds } });
  } else if (genreKeys.length > 0) {
    pushFilter(andFilters, { genreKeys: { $all: genreKeys } });
  }

  const sourceKeys = toFilterKeys(query.source);
  if (sourceKeys.length > 0) {
    pushFilter(andFilters, { originalSourceKey: sourceKeys[0] });
  }

  const publicationStatusId = typeof query.publicationStatusId === 'string' && mongoose.Types.ObjectId.isValid(query.publicationStatusId)
    ? new mongoose.Types.ObjectId(query.publicationStatusId)
    : undefined;
  const publicationStatusKeys = toFilterKeys(query.publicationStatus || query.catalogStatus || query.status);
  if (publicationStatusId) {
    pushFilter(andFilters, { publicationStatusId });
  } else if (publicationStatusKeys.length > 0) {
    pushFilter(andFilters, { publicationStatusKey: publicationStatusKeys[0] });
  }

  if (typeof query.authorId === 'string' && mongoose.Types.ObjectId.isValid(query.authorId)) {
    const authorId = new mongoose.Types.ObjectId(query.authorId);
    pushFilter(andFilters, {
      $or: [
        { authorIds: authorId },
        { authorId },
      ],
    });
  }
}

async function applySharedNovelUpdates(novel: any, updates: Record<string, any>) {
  if (updates.title !== undefined) novel.title = String(updates.title || '').trim() || novel.title;
  if (updates.author !== undefined) novel.author = String(updates.author || '').trim();
  if (updates.authorPenName !== undefined) novel.authorPenName = String(updates.authorPenName || '').trim();
  if (updates.authorRealName !== undefined) novel.authorRealName = String(updates.authorRealName || '').trim();
  if (updates.alternativeNames !== undefined) {
    novel.alternativeNames = Array.isArray(updates.alternativeNames) ? updates.alternativeNames : [];
  }
  if (updates.originalSource !== undefined) novel.originalSource = String(updates.originalSource || '').trim();
  if (updates.description !== undefined) novel.description = String(updates.description || '').trim();
  if (updates.coverUrl !== undefined) novel.coverUrl = String(updates.coverUrl || '').trim();
  if (updates.sourceUrl !== undefined) novel.sourceUrl = String(updates.sourceUrl || '').trim();
  if (updates.rawSourceUrl !== undefined) novel.rawSourceUrl = String(updates.rawSourceUrl || '').trim();
  if (updates.rawOriginalLanguage !== undefined) novel.rawOriginalLanguage = String(updates.rawOriginalLanguage || '').trim();

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
      author: updates.author ?? novel.author,
      penName: updates.authorPenName ?? updates.author ?? novel.authorPenName,
      realName: updates.authorRealName ?? novel.authorRealName,
      alternativeNames: updates.alternativeNames ?? novel.alternativeNames,
      originalLanguage: updates.rawOriginalLanguage ?? novel.rawOriginalLanguage,
      officialUrl: updates.sourceUrl ?? novel.sourceUrl,
    });
    if (authorIds.length > 0) {
      novel.authorIds = authorIds;
      novel.authorId = authorIds[0];
    }
  }

  if (updates.genreIds !== undefined || updates.genres !== undefined) {
    const resolvedGenres = await resolveGenres({
      genreIds: updates.genreIds,
      genres: updates.genres,
    });
    novel.genreIds = resolvedGenres.genreIds;
    novel.genres = resolvedGenres.genres;
    novel.genreKeys = resolvedGenres.genreKeys;
  }

  if (updates.publicationStatusId !== undefined || updates.publicationStatus !== undefined) {
    const resolvedStatus = await resolvePublicationStatus({
      publicationStatusId: updates.publicationStatusId,
      publicationStatus: updates.publicationStatus,
    });
    if (resolvedStatus.publicationStatusId) {
      novel.publicationStatusId = resolvedStatus.publicationStatusId;
      novel.publicationStatus = resolvedStatus.publicationStatus || '';
      novel.publicationStatusKey = resolvedStatus.publicationStatusKey || '';
    } else if (updates.publicationStatus === '') {
      novel.publicationStatusId = undefined;
      novel.publicationStatus = '';
      novel.publicationStatusKey = '';
    }
  }
}

export async function listNovelsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { status } = request.query as any;

  try {
    const legacyNovels = await Novel.find({ userId }).sort({ updatedAt: -1 });
    await Promise.all(legacyNovels.map(syncUserNovelFromLegacyNovel));

    const userNovelFilter: Record<string, any> = { userId };
    if (typeof status === 'string' && status !== 'all' && VALID_NOVEL_STATUSES.has(status as NovelStatus)) {
      userNovelFilter.status = status;
    }

    const userNovels = await UserNovel.find(userNovelFilter).sort({ updatedAt: -1 });
    const userNovelByNovelId = new Map(userNovels.map((item) => [item.novelId.toString(), item]));

    const filter: Record<string, any> = {
      _id: { $in: userNovels.map((item) => item.novelId) },
    };
    const andFilters: any[] = [filter];
    applySharedNovelFilters(andFilters, { ...(request.query as any), status: undefined });
    const novelFilter = andFilters.length > 1 ? { $and: andFilters } : filter;

    const novels = await Novel.find(novelFilter);
    if (novels.some((novel) => !novel.addedByUserId && novel.userId)) {
      await Promise.all(novels.map(async (novel) => {
        if (!novel.addedByUserId && novel.userId) {
          novel.addedByUserId = novel.userId;
          await novel.save();
        }
      }));
    }
    const novelById = new Map(novels.map((novel) => [novel._id.toString(), novel]));
    const serialized = userNovels
      .map((userNovel) => {
        const novel = novelById.get(userNovel.novelId.toString());
        return novel ? serializeNovelForUser(novel, userNovel) : null;
      })
      .filter(Boolean);

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing novels.' });
  }
}

export async function listCatalogNovelsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const andFilters: any[] = [];
    applySharedNovelFilters(andFilters, request.query as any);
    const filter = andFilters.length > 0 ? { $and: andFilters } : {};

    const novels = await Novel.find(filter).sort({ updatedAt: -1 });
    return reply.send(novels);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing catalog novels.' });
  }
}

export async function getCatalogNovelHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const novel = await Novel.findById(id);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    return reply.send(novel);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching catalog novel.' });
  }
}

export async function createNovelHandler(request: FastifyRequest, reply: FastifyReply) {
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
    status,
    chaptersRead,
    rating,
    review,
    personalNotes,
    rawLegacyEntry,
    characterNotes,
    relationshipNotes,
    personalTags,
    completedAt,
  } = request.body as any;

  try {
    // If no title is given, but URL is provided, we can assign a placeholder that updates on scrape
    const finalTitle = title || (sourceUrl ? 'Pending Scrape' : 'Untitled Novel');
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

    const novel = await Novel.create({
      userId: new mongoose.Types.ObjectId(userId),
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
      chaptersList: []
    });

    const userNovel = await UserNovel.create({
      userId: new mongoose.Types.ObjectId(userId),
      novelId: novel._id,
      status: status || 'reading',
      chaptersRead: chaptersRead || 0,
      rating: rating || 0,
      review: review || '',
      personalNotes: personalNotes || '',
      rawLegacyEntry: rawLegacyEntry || '',
      characterNotes: characterNotes || '',
      relationshipNotes: relationshipNotes || '',
      personalTags: Array.isArray(personalTags) ? personalTags : [],
      completedAt: completedAt || (status === 'completed' ? new Date() : undefined),
    });

    // If sourceUrl is provided, trigger a background metadata job
    if (sourceUrl) {
      await BackgroundJob.create({
        novelId: novel._id,
        userId: new mongoose.Types.ObjectId(userId),
        type: 'scrape_metadata',
        status: 'pending',
      });
    }

    return reply.status(201).send(serializeNovelForUser(novel, userNovel));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error creating novel.' });
  }
}

export async function addNovelToLibraryHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const novel = await Novel.findById(id);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    const userNovel = await UserNovel.findOneAndUpdate(
      { userId, novelId: novel._id },
      {
        $setOnInsert: {
          status: 'planning',
          chaptersRead: 0,
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

    return reply.status(201).send(serializeNovelForUser(novel, userNovel));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error adding novel to library.' });
  }
}

export async function getNovelHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    let userNovel = await UserNovel.findOne({ novelId: id, userId });
    let novel = await Novel.findById(id);

    if (!userNovel && (novel?.userId?.toString() === userId || novel?.addedByUserId?.toString() === userId)) {
      await syncUserNovelFromLegacyNovel(novel);
      userNovel = await UserNovel.findOne({ novelId: id, userId });
    }

    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }
    if (!userNovel) {
      return reply.status(404).send({ error: 'Novel not found in your library.' });
    }
    return reply.send(serializeNovelForUser(novel, userNovel));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching novel.' });
  }
}

export async function updateNovelHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;
  const updates = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
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

    let userNovel = await UserNovel.findOne({ novelId: id, userId });
    const novel = await Novel.findById(id);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found or unauthorized.' });
    }

    const ownsLegacyNovel = novel.userId?.toString() === userId || novel.addedByUserId?.toString() === userId;
    if (!userNovel && ownsLegacyNovel) {
      await syncUserNovelFromLegacyNovel(novel);
      userNovel = await UserNovel.findOne({ novelId: id, userId });
    }
    if (!userNovel) {
      return reply.status(404).send({ error: 'Novel not found in your library.' });
    }

    const isAdmin = await isAdminRequest(request);
    const personalUpdates = pickPersonalLibraryUpdates(updates);
    const sharedUpdates = pickSharedNovelUpdates(updates);
    const nextCoverUrl = typeof updates.coverUrl === 'string' ? updates.coverUrl.trim() : undefined;
    if (isAdmin && nextCoverUrl !== undefined && nextCoverUrl !== novel.coverUrl) {
      await deleteCoverImageFile(novel.coverImagePath);
      novel.coverImagePath = '';
      novel.coverImageMimeType = '';
      novel.coverImageSize = 0;
      novel.coverImageToken = '';
      novel.coverImageSyncedAt = undefined;
    }

    Object.assign(userNovel, personalUpdates);

    if (isAdmin && Object.keys(sharedUpdates).length > 0) {
      await applySharedNovelUpdates(novel, sharedUpdates);
    }

    // Auto-mark completed if chaptersRead matches chaptersTotal and chaptersTotal > 0
    if (novel.chaptersTotal > 0 && userNovel.chaptersRead >= novel.chaptersTotal && userNovel.status !== 'completed') {
      userNovel.status = 'completed';
    }

    if (userNovel.status === 'completed' && !userNovel.completedAt) {
      userNovel.completedAt = new Date();
    }

    await userNovel.save();
    if (isAdmin && Object.keys(sharedUpdates).length > 0) {
      await novel.save();
    }
    return reply.send(serializeNovelForUser(novel, userNovel));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating novel.' });
  }
}

export async function updateCatalogNovelHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!(await isAdminRequest(request))) {
    return reply.status(403).send({ error: 'Admin access is required to edit catalog novel metadata.' });
  }

  const { id } = request.params as any;
  const updates = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const novel = await Novel.findById(id);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    const sharedUpdates = pickSharedNovelUpdates(updates);
    const nextCoverUrl = typeof sharedUpdates.coverUrl === 'string' ? sharedUpdates.coverUrl.trim() : undefined;
    if (nextCoverUrl !== undefined && nextCoverUrl !== novel.coverUrl) {
      await deleteCoverImageFile(novel.coverImagePath);
      novel.coverImagePath = '';
      novel.coverImageMimeType = '';
      novel.coverImageSize = 0;
      novel.coverImageToken = '';
      novel.coverImageSyncedAt = undefined;
    }

    await applySharedNovelUpdates(novel, sharedUpdates);
    await novel.save();

    return reply.send(novel);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating catalog novel.' });
  }
}

export async function deleteNovelHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const novel = await Novel.findById(id);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    let userNovel = await UserNovel.findOne({ novelId: id, userId });
    const ownsLegacyNovel = novel.userId?.toString() === userId || novel.addedByUserId?.toString() === userId;
    if (!userNovel && ownsLegacyNovel) {
      await syncUserNovelFromLegacyNovel(novel);
      userNovel = await UserNovel.findOne({ novelId: id, userId });
    }

    if (!userNovel) {
      return reply.status(404).send({ error: 'Novel not found in your library.' });
    }

    await UserNovel.deleteOne({ _id: userNovel._id });
    await ReadingSession.deleteMany({ novelId: id, userId });
    await ChapterVisit.deleteMany({ novelId: id, userId });

    return reply.send({ success: true, message: 'Novel removed from your library.' });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error deleting novel.' });
  }
}

export async function deleteCatalogNovelHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!(await isAdminRequest(request))) {
    return reply.status(403).send({ error: 'Admin access is required to delete catalog novels.' });
  }

  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const novel = await Novel.findById(id);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    await UserNovel.deleteMany({ novelId: id });
    await ReadingSession.deleteMany({ novelId: id });
    await ChapterVisit.deleteMany({ novelId: id });
    await ChapterContent.deleteMany({ novelId: id });
    await RawChapterContent.deleteMany({ novelId: id });
    await BackgroundJob.deleteMany({ novelId: id });
    await deleteCoverImageFile(novel.coverImagePath);
    await Novel.deleteOne({ _id: id });

    return reply.send({ success: true, message: 'Catalog novel and related archive data deleted.' });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error deleting catalog novel.' });
  }
}

// Re-read Log Controllers
export async function listReadingSessionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: novelId } = request.params as any;

  try {
    const sessions = await ReadingSession.find({ novelId, userId }).sort({ startDate: -1 });
    return reply.send(sessions);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing reading sessions.' });
  }
}

export async function startReadingSessionHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: novelId } = request.params as any;
  const { notes, chaptersRead } = request.body as any;

  try {
    const novel = await Novel.findById(novelId);
    let userNovel = await UserNovel.findOne({ novelId, userId });
    if (!userNovel && (novel?.userId?.toString() === userId || novel?.addedByUserId?.toString() === userId)) {
      await syncUserNovelFromLegacyNovel(novel);
      userNovel = await UserNovel.findOne({ novelId, userId });
    }
    if (!novel || !userNovel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    // Create session
    const session = await ReadingSession.create({
      novelId: novel._id,
      userId: new mongoose.Types.ObjectId(userId),
      startDate: new Date(),
      notes: notes || 'Started re-reading.',
      chaptersRead: chaptersRead || 0,
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
  const { id: novelId, sessionId } = request.params as any;
  const { notes, chaptersRead, completed } = request.body as any;

  try {
    const session = await ReadingSession.findOne({ _id: sessionId, novelId, userId });
    if (!session) {
      return reply.status(404).send({ error: 'Reading session not found.' });
    }

    if (chaptersRead !== undefined) session.chaptersRead = chaptersRead;
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

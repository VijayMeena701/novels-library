import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { Novel } from '../models/Novel.js';
import { ChapterContent } from '../models/ChapterContent.js';
import { RawChapterContent } from '../models/RawChapterContent.js';
import { ReadingSession } from '../models/ReadingSession.js';
import { ChapterVisit } from '../models/ChapterVisit.js';
import { UserNovel } from '../models/UserNovel.js';
import { translateChapterHtml } from '../services/translation.js';
import { isAdminRequest } from '../services/permissions.js';

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isGenericChapterTitle(value: string, novelTitle: string, chapterNumber: number): boolean {
  const normalized = normalizeTitle(value);
  return !normalized ||
    normalized === normalizeTitle(novelTitle) ||
    normalized === `chapter ${chapterNumber}` ||
    normalized === `ch ${chapterNumber}`;
}

function selectDisplayChapterTitle(
  indexedTitle: string | undefined,
  archivedTitle: string | undefined,
  novelTitle: string,
  chapterNumber: number,
): string {
  const cleanIndexedTitle = indexedTitle?.replace(/\s+/g, ' ').trim() || '';
  const cleanArchivedTitle = archivedTitle?.replace(/\s+/g, ' ').trim() || '';

  if (cleanIndexedTitle && isGenericChapterTitle(cleanArchivedTitle, novelTitle, chapterNumber)) {
    return cleanIndexedTitle;
  }

  return cleanArchivedTitle || cleanIndexedTitle || `Chapter ${chapterNumber}`;
}

async function findUserLibraryNovel(novelId: string, userId: string) {
  const novel = await Novel.findById(novelId);
  if (!novel) return null;

  const userNovel = await UserNovel.findOne({ novelId, userId });
  if (userNovel || novel.userId?.toString() === userId) {
    return novel;
  }

  return null;
}

export async function listChaptersHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: novelId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const novel = await findUserLibraryNovel(novelId, userId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found or unauthorized.' });
    }

    // Find all chapters matching this novel, project metadata only (exclude the raw content body)
    const chapters = await ChapterContent.find({ novelId })
      .select('chapterNumber title sourceUrl scrapedAt')
      .sort({ chapterNumber: 1 });
    const chapterIndexByNumber = new Map((novel.chaptersList || []).map((chapter) => [chapter.number, chapter]));

    return reply.send(chapters.map((chapter) => {
      const indexedChapter = chapterIndexByNumber.get(chapter.chapterNumber);
      const serialized = chapter.toObject();
      serialized.title = selectDisplayChapterTitle(indexedChapter?.title, serialized.title, novel.title, chapter.chapterNumber);
      return serialized;
    }));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing archived chapters.' });
  }
}

export async function listPublicChaptersHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: novelId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    const chapters = await ChapterContent.find({ novelId })
      .select('chapterNumber title sourceUrl scrapedAt')
      .sort({ chapterNumber: 1 });
    const chapterIndexByNumber = new Map((novel.chaptersList || []).map((chapter) => [chapter.number, chapter]));

    return reply.send(chapters.map((chapter) => {
      const indexedChapter = chapterIndexByNumber.get(chapter.chapterNumber);
      const serialized = chapter.toObject();
      serialized.title = selectDisplayChapterTitle(indexedChapter?.title, serialized.title, novel.title, chapter.chapterNumber);
      return serialized;
    }));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing public chapters.' });
  }
}

export async function getChapterHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: novelId, chapterNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  const parsedChNumber = parseInt(chapterNumber, 10);
  if (isNaN(parsedChNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    const novel = await findUserLibraryNovel(novelId, userId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found or unauthorized.' });
    }

    // Retrieve full chapter contents including the content body
    const chapter = await ChapterContent.findOne({ novelId, chapterNumber: parsedChNumber });
    if (!chapter) {
      return reply.status(404).send({ error: `Chapter ${parsedChNumber} has not been scraped/archived yet.` });
    }

    const indexedChapter = (novel.chaptersList || []).find((item) => item.number === chapter.chapterNumber);
    const serialized = chapter.toObject();
    serialized.title = selectDisplayChapterTitle(indexedChapter?.title, serialized.title, novel.title, chapter.chapterNumber);

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching chapter content.' });
  }
}

export async function listRawChaptersHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: novelId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const novel = await findUserLibraryNovel(novelId, userId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found or unauthorized.' });
    }

    const chapters = await RawChapterContent.find({ novelId })
      .select('chapterNumber title sourceUrl language scrapedAt')
      .sort({ chapterNumber: 1 });
    const chapterIndexByNumber = new Map((novel.rawChaptersList || []).map((chapter) => [chapter.number, chapter]));

    return reply.send(chapters.map((chapter) => {
      const indexedChapter = chapterIndexByNumber.get(chapter.chapterNumber);
      const serialized = chapter.toObject();
      serialized.title = selectDisplayChapterTitle(indexedChapter?.title, serialized.title, novel.title, chapter.chapterNumber);
      return serialized;
    }));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing archived raw chapters.' });
  }
}

export async function listPublicRawChaptersHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: novelId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    const chapters = await RawChapterContent.find({ novelId })
      .select('chapterNumber title sourceUrl language scrapedAt')
      .sort({ chapterNumber: 1 });
    const chapterIndexByNumber = new Map((novel.rawChaptersList || []).map((chapter) => [chapter.number, chapter]));

    return reply.send(chapters.map((chapter) => {
      const indexedChapter = chapterIndexByNumber.get(chapter.chapterNumber);
      const serialized = chapter.toObject();
      serialized.title = selectDisplayChapterTitle(indexedChapter?.title, serialized.title, novel.title, chapter.chapterNumber);
      return serialized;
    }));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing public raw chapters.' });
  }
}

export async function getRawChapterHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: novelId, chapterNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  const parsedChNumber = Number.parseInt(chapterNumber, 10);
  if (Number.isNaN(parsedChNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    const novel = await findUserLibraryNovel(novelId, userId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found or unauthorized.' });
    }

    const chapter = await RawChapterContent.findOne({ novelId, chapterNumber: parsedChNumber });
    if (!chapter) {
      return reply.status(404).send({ error: `Raw chapter ${parsedChNumber} has not been archived yet.` });
    }

    const indexedChapter = (novel.rawChaptersList || []).find((item) => item.number === chapter.chapterNumber);
    const serialized = chapter.toObject();
    serialized.title = selectDisplayChapterTitle(indexedChapter?.title, serialized.title, novel.title, chapter.chapterNumber);

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching raw chapter content.' });
  }
}

export async function getPublicRawChapterHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: novelId, chapterNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  const parsedChNumber = Number.parseInt(chapterNumber, 10);
  if (Number.isNaN(parsedChNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    const chapter = await RawChapterContent.findOne({ novelId, chapterNumber: parsedChNumber });
    if (!chapter) {
      return reply.status(404).send({ error: `Raw chapter ${parsedChNumber} has not been archived yet.` });
    }

    const indexedChapter = (novel.rawChaptersList || []).find((item) => item.number === chapter.chapterNumber);
    const serialized = chapter.toObject();
    serialized.title = selectDisplayChapterTitle(indexedChapter?.title, serialized.title, novel.title, chapter.chapterNumber);

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching public raw chapter.' });
  }
}

export async function translateRawChapterHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: novelId, chapterNumber } = request.params as any;
  const { targetLanguage, overwrite } = (request.body || {}) as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  const parsedChNumber = Number.parseInt(chapterNumber, 10);
  if (Number.isNaN(parsedChNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    if (!(await isAdminRequest(request))) {
      return reply.status(403).send({ error: 'Admin access is required to generate and store translated chapters.' });
    }

    const novel = await Novel.findById(novelId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    const rawChapter = await RawChapterContent.findOne({ novelId, chapterNumber: parsedChNumber });
    if (!rawChapter) {
      return reply.status(404).send({ error: `Raw chapter ${parsedChNumber} has not been archived yet.` });
    }

    const existingTranslated = await ChapterContent.findOne({ novelId, chapterNumber: parsedChNumber });
    if (existingTranslated && !overwrite) {
      return reply.send({
        success: true,
        message: `Translated chapter ${parsedChNumber} already exists.`,
        chapter: existingTranslated,
        reusedExisting: true,
      });
    }

    const translated = await translateChapterHtml({
      html: rawChapter.content,
      title: rawChapter.title,
      sourceLanguage: rawChapter.language || novel.rawOriginalLanguage,
      targetLanguage,
    });

    const chapter = await ChapterContent.findOneAndUpdate(
      {
        novelId,
        chapterNumber: parsedChNumber,
      },
      {
        $set: {
          novelId,
          chapterNumber: parsedChNumber,
          title: translated.title,
          content: translated.content,
          sourceUrl: rawChapter.sourceUrl,
          scrapedAt: new Date(),
        },
      },
      { new: true, upsert: true },
    );

    return reply.send({
      success: true,
      message: `Generated translated chapter ${parsedChNumber}.`,
      chapter,
      model: translated.model,
      reusedExisting: false,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error translating raw chapter.' });
  }
}

export async function getPublicChapterHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: novelId, chapterNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  const parsedChNumber = parseInt(chapterNumber, 10);
  if (isNaN(parsedChNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }

    const chapter = await ChapterContent.findOne({ novelId, chapterNumber: parsedChNumber });
    if (!chapter) {
      return reply.status(404).send({ error: `Chapter ${parsedChNumber} has not been archived yet.` });
    }

    const indexedChapter = (novel.chaptersList || []).find((item) => item.number === chapter.chapterNumber);
    const serialized = chapter.toObject();
    serialized.title = selectDisplayChapterTitle(indexedChapter?.title, serialized.title, novel.title, chapter.chapterNumber);

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching public chapter.' });
  }
}

export async function listChapterVisitsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: novelId } = request.params as any;
  const { limit } = request.query as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  const parsedLimit = Number.parseInt(limit || '100', 10);
  const safeLimit = Number.isFinite(parsedLimit) ? Math.min(500, Math.max(1, parsedLimit)) : 100;

  try {
    const novel = await findUserLibraryNovel(novelId, userId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found or unauthorized.' });
    }

    const visits = await ChapterVisit.find({ novelId, userId })
      .sort({ openedAt: -1 })
      .limit(safeLimit);

    return reply.send(visits);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing chapter visits.' });
  }
}

export async function recordChapterVisitHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: novelId, chapterNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  const parsedChNumber = Number.parseInt(chapterNumber, 10);
  if (Number.isNaN(parsedChNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    const novel = await findUserLibraryNovel(novelId, userId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found or unauthorized.' });
    }

    const chapter = await ChapterContent.findOne({ novelId, chapterNumber: parsedChNumber })
      .select('chapterNumber title sourceUrl');
    if (!chapter) {
      return reply.status(404).send({ error: `Chapter ${parsedChNumber} has not been scraped/archived yet.` });
    }

    const activeSession = await ReadingSession.findOne({
      novelId,
      userId,
      completed: false,
    }).sort({ startDate: -1 });

    const visit = await ChapterVisit.create({
      novelId: novel._id,
      userId: new mongoose.Types.ObjectId(userId),
      sessionId: activeSession?._id,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title || `Chapter ${chapter.chapterNumber}`,
      sourceUrl: chapter.sourceUrl || '',
      openedAt: new Date(),
    });

    return reply.status(201).send(visit);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error recording chapter visit.' });
  }
}

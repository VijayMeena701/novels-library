import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { Book } from '../models/Book';
import { ChapterContent } from '../models/ChapterContent';
import { RawChapterContent } from '../models/RawChapterContent';
import { ReadingSession } from '../models/ReadingSession';
import { ChapterVisit } from '../models/ChapterVisit';
import { UserBook } from '../models/UserBook';
import { translateChapterHtml } from '../services/translation';
import { hasCapability, CAPABILITY } from '../services/rbac';

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isGenericChapterTitle(value: string, bookTitle: string, chapterNumber: number): boolean {
  const normalized = normalizeTitle(value);
  return (
    !normalized ||
    normalized === normalizeTitle(bookTitle) ||
    normalized === `chapter ${chapterNumber}` ||
    normalized === `ch ${chapterNumber}`
  );
}

function selectDisplayChapterTitle(
  indexedTitle: string | undefined,
  archivedTitle: string | undefined,
  bookTitle: string,
  chapterNumber: number,
): string {
  const cleanIndexedTitle = indexedTitle?.replace(/\s+/g, ' ').trim() || '';
  const cleanArchivedTitle = archivedTitle?.replace(/\s+/g, ' ').trim() || '';

  if (cleanIndexedTitle && isGenericChapterTitle(cleanArchivedTitle, bookTitle, chapterNumber)) {
    return cleanIndexedTitle;
  }

  return cleanArchivedTitle || cleanIndexedTitle || `Chapter ${chapterNumber}`;
}

async function findUserLibraryBook(bookId: string, userId: string) {
  const book = await Book.findById(bookId);
  if (!book) return null;

  const userBook = await UserBook.findOne({ bookId, userId });
  return userBook ? book : null;
}

export async function listChaptersHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await findUserLibraryBook(bookId, userId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found or unauthorized.' });
    }

    // Find all chapters matching this book, project metadata only (exclude the raw content body)
    const chapters = await ChapterContent.find({ bookId })
      .select('chapterNumber title sourceUrl scrapedAt')
      .sort({ chapterNumber: 1 });
    const chapterIndexByNumber = new Map(
      (book.translatedChaptersList || []).map((chapter) => [chapter.chapterNumber, chapter]),
    );

    return reply.send(
      chapters.map((chapter) => {
        const indexedChapter = chapterIndexByNumber.get(chapter.chapterNumber);
        const serialized = chapter.toObject();
        serialized.title = selectDisplayChapterTitle(
          indexedChapter?.title,
          serialized.title,
          book.title,
          chapter.chapterNumber,
        );
        return serialized;
      }),
    );
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing archived chapters.' });
  }
}

export async function listPublicChaptersHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: bookId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const chapters = await ChapterContent.find({ bookId })
      .select('chapterNumber title sourceUrl scrapedAt')
      .sort({ chapterNumber: 1 });
    const chapterIndexByNumber = new Map(
      (book.translatedChaptersList || []).map((chapter) => [chapter.chapterNumber, chapter]),
    );

    return reply.send(
      chapters.map((chapter) => {
        const indexedChapter = chapterIndexByNumber.get(chapter.chapterNumber);
        const serialized = chapter.toObject();
        serialized.title = selectDisplayChapterTitle(
          indexedChapter?.title,
          serialized.title,
          book.title,
          chapter.chapterNumber,
        );
        return serialized;
      }),
    );
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing public chapters.' });
  }
}

export async function getChapterHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId, chapterNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedChapterNumber = Number.parseInt(chapterNumber, 10);
  if (Number.isNaN(parsedChapterNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    const book = await findUserLibraryBook(bookId, userId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found or unauthorized.' });
    }

    // Retrieve full chapter contents including the content body
    const chapter = await ChapterContent.findOne({ bookId, chapterNumber: parsedChapterNumber });
    if (!chapter) {
      return reply.status(404).send({ error: `Chapter ${parsedChapterNumber} has not been scraped/archived yet.` });
    }

    const indexedChapter = (book.translatedChaptersList || []).find(
      (item) => item.chapterNumber === chapter.chapterNumber,
    );
    const serialized = chapter.toObject();
    serialized.title = selectDisplayChapterTitle(
      indexedChapter?.title,
      serialized.title,
      book.title,
      chapter.chapterNumber,
    );

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching chapter content.' });
  }
}

export async function listRawChaptersHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await findUserLibraryBook(bookId, userId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found or unauthorized.' });
    }

    const chapters = await RawChapterContent.find({ bookId })
      .select('chapterNumber title sourceUrl language scrapedAt')
      .sort({ chapterNumber: 1 });
    const chapterIndexByNumber = new Map(
      (book.rawChaptersList || []).map((chapter) => [chapter.chapterNumber, chapter]),
    );

    return reply.send(
      chapters.map((chapter) => {
        const indexedChapter = chapterIndexByNumber.get(chapter.chapterNumber);
        const serialized = chapter.toObject();
        serialized.title = selectDisplayChapterTitle(
          indexedChapter?.title,
          serialized.title,
          book.title,
          chapter.chapterNumber,
        );
        return serialized;
      }),
    );
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing archived raw chapters.' });
  }
}

export async function listPublicRawChaptersHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: bookId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const chapters = await RawChapterContent.find({ bookId })
      .select('chapterNumber title sourceUrl language scrapedAt')
      .sort({ chapterNumber: 1 });
    const chapterIndexByNumber = new Map(
      (book.rawChaptersList || []).map((chapter) => [chapter.chapterNumber, chapter]),
    );

    return reply.send(
      chapters.map((chapter) => {
        const indexedChapter = chapterIndexByNumber.get(chapter.chapterNumber);
        const serialized = chapter.toObject();
        serialized.title = selectDisplayChapterTitle(
          indexedChapter?.title,
          serialized.title,
          book.title,
          chapter.chapterNumber,
        );
        return serialized;
      }),
    );
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing public raw chapters.' });
  }
}

export async function getRawChapterHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId, chapterNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedChapterNumber = Number.parseInt(chapterNumber, 10);
  if (Number.isNaN(parsedChapterNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    const book = await findUserLibraryBook(bookId, userId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found or unauthorized.' });
    }

    const chapter = await RawChapterContent.findOne({ bookId, chapterNumber: parsedChapterNumber });
    if (!chapter) {
      return reply.status(404).send({ error: `Raw chapter ${parsedChapterNumber} has not been archived yet.` });
    }

    const indexedChapter = (book.rawChaptersList || []).find((item) => item.chapterNumber === chapter.chapterNumber);
    const serialized = chapter.toObject();
    serialized.title = selectDisplayChapterTitle(
      indexedChapter?.title,
      serialized.title,
      book.title,
      chapter.chapterNumber,
    );

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching raw chapter content.' });
  }
}

export async function getPublicRawChapterHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: bookId, chapterNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedChapterNumber = Number.parseInt(chapterNumber, 10);
  if (Number.isNaN(parsedChapterNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const chapter = await RawChapterContent.findOne({ bookId, chapterNumber: parsedChapterNumber });
    if (!chapter) {
      return reply.status(404).send({ error: `Raw chapter ${parsedChapterNumber} has not been archived yet.` });
    }

    const indexedChapter = (book.rawChaptersList || []).find((item) => item.chapterNumber === chapter.chapterNumber);
    const serialized = chapter.toObject();
    serialized.title = selectDisplayChapterTitle(
      indexedChapter?.title,
      serialized.title,
      book.title,
      chapter.chapterNumber,
    );

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching public raw chapter.' });
  }
}

export async function translateRawChapterHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: bookId, chapterNumber } = request.params as any;
  const { targetLanguage, overwrite } = (request.body || {}) as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedChapterNumber = Number.parseInt(chapterNumber, 10);
  if (Number.isNaN(parsedChapterNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.CHAPTERS_TRANSLATE))) {
      return reply.status(403).send({ error: 'Admin access is required to generate and store translated chapters.' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const rawChapter = await RawChapterContent.findOne({ bookId, chapterNumber: parsedChapterNumber });
    if (!rawChapter) {
      return reply.status(404).send({ error: `Raw chapter ${parsedChapterNumber} has not been archived yet.` });
    }

    const existingTranslated = await ChapterContent.findOne({ bookId, chapterNumber: parsedChapterNumber });
    if (existingTranslated && !overwrite) {
      return reply.send({
        success: true,
        message: `Translated chapter ${parsedChapterNumber} already exists.`,
        chapter: existingTranslated,
        reusedExisting: true,
      });
    }

    request.log.info(
      `[translateRawChapter] starting chapter ${parsedChapterNumber} for book ${bookId} targetLanguage=${targetLanguage || 'default'} overwrite=${Boolean(overwrite)}`,
    );

    const translated = await translateChapterHtml({
      html: rawChapter.content,
      title: rawChapter.title,
      sourceLanguage: rawChapter.language || book.rawOriginalLanguage,
      targetLanguage,
      logger: request.log,
    });

    request.log.info(
      `[translateRawChapter] completed chapter ${parsedChapterNumber} model=${translated.model} title="${translated.title}" contentLength=${translated.content.length}`,
    );

    const chapter = await ChapterContent.findOneAndUpdate(
      {
        bookId,
        chapterNumber: parsedChapterNumber,
      },
      {
        $set: {
          bookId,
          chapterNumber: parsedChapterNumber,
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
      message: `Generated translated chapter ${parsedChapterNumber}.`,
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
  const { id: bookId, chapterNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedChapterNumber = Number.parseInt(chapterNumber, 10);
  if (Number.isNaN(parsedChapterNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const chapter = await ChapterContent.findOne({ bookId, chapterNumber: parsedChapterNumber });
    if (!chapter) {
      return reply.status(404).send({ error: `Chapter ${parsedChapterNumber} has not been archived yet.` });
    }

    const indexedChapter = (book.translatedChaptersList || []).find(
      (item) => item.chapterNumber === chapter.chapterNumber,
    );
    const serialized = chapter.toObject();
    serialized.title = selectDisplayChapterTitle(
      indexedChapter?.title,
      serialized.title,
      book.title,
      chapter.chapterNumber,
    );

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching public chapter.' });
  }
}

export async function listChapterVisitsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId } = request.params as any;
  const { limit } = request.query as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedLimit = Number.parseInt(limit || '100', 10);
  const safeLimit = Number.isFinite(parsedLimit) ? Math.min(500, Math.max(1, parsedLimit)) : 100;

  try {
    const book = await findUserLibraryBook(bookId, userId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found or unauthorized.' });
    }

    const visits = await ChapterVisit.find({ bookId, userId }).sort({ openedAt: -1 }).limit(safeLimit);

    return reply.send(visits);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing chapter visits.' });
  }
}

export async function recordChapterVisitHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId, chapterNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedChapterNumber = Number.parseInt(chapterNumber, 10);
  if (Number.isNaN(parsedChapterNumber)) {
    return reply.status(400).send({ error: 'Invalid chapter number.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const chapter = await ChapterContent.findOne({ bookId, chapterNumber: parsedChapterNumber }).select(
      'chapterNumber title sourceUrl',
    );
    if (!chapter) {
      return reply.status(404).send({ error: `Chapter ${parsedChapterNumber} has not been scraped/archived yet.` });
    }

    const activeSession = await ReadingSession.findOne({
      bookId,
      userId,
      completed: false,
    }).sort({ startDate: -1 });

    const visit = await ChapterVisit.create({
      bookId: book._id,
      userId: new mongoose.Types.ObjectId(userId),
      sessionId: activeSession?._id,
      chapterNumber: chapter.chapterNumber,
      chapterType: 'chapter',
      chapterTitle: chapter.title || `Chapter ${chapter.chapterNumber}`,
      sourceUrl: chapter.sourceUrl || '',
      openedAt: new Date(),
    });

    await UserBook.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), bookId: book._id },
      {
        $setOnInsert: {
          status: 'reading',
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
      { new: true, upsert: true },
    );

    await UserBook.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), bookId: book._id },
      {
        $max: { chaptersRead: parsedChapterNumber },
        $set: { lastVisitedChapterNumber: parsedChapterNumber, lastVisitedAt: new Date() },
      },
      { new: true },
    );

    return reply.status(201).send(visit);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error recording chapter visit.' });
  }
}

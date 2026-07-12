import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { Book } from '../models/Novel.js';
import { BookContent } from '../models/ChapterContent.js';
import { RawBookContent } from '../models/RawChapterContent.js';
import { ReadingSession } from '../models/ReadingSession.js';
import { BookVisit } from '../models/ChapterVisit.js';
import { UserBook } from '../models/UserNovel.js';
import { translateUnitHtml } from '../services/translation.js';
import { hasCapability, CAPABILITY } from '../services/rbac.js';

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isGenericUnitTitle(value: string, bookTitle: string, unitNumber: number): boolean {
  const normalized = normalizeTitle(value);
  return !normalized ||
    normalized === normalizeTitle(bookTitle) ||
    normalized === `unit ${unitNumber}` ||
    normalized === `ch ${unitNumber}`;
}

function selectDisplayUnitTitle(
  indexedTitle: string | undefined,
  archivedTitle: string | undefined,
  bookTitle: string,
  unitNumber: number,
): string {
  const cleanIndexedTitle = indexedTitle?.replace(/\s+/g, ' ').trim() || '';
  const cleanArchivedTitle = archivedTitle?.replace(/\s+/g, ' ').trim() || '';

  if (cleanIndexedTitle && isGenericUnitTitle(cleanArchivedTitle, bookTitle, unitNumber)) {
    return cleanIndexedTitle;
  }

  return cleanArchivedTitle || cleanIndexedTitle || `Unit ${unitNumber}`;
}

async function findUserLibraryBook(bookId: string, userId: string) {
  const book = await Book.findById(bookId);
  if (!book) return null;

  const userBook = await UserBook.findOne({ bookId, userId });
  if (userBook || book.userId?.toString() === userId) {
    return book;
  }

  return null;
}

export async function listUnitsHandler(request: FastifyRequest, reply: FastifyReply) {
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

    // Find all units matching this book, project metadata only (exclude the raw content body)
    const units = await BookContent.find({ bookId })
      .select('unitNumber title sourceUrl scrapedAt')
      .sort({ unitNumber: 1 });
    const unitIndexByNumber = new Map((book.translatedUnitsList || []).map((unit) => [unit.unitNumber, unit]));

    return reply.send(units.map((unit) => {
      const indexedUnit = unitIndexByNumber.get(unit.unitNumber);
      const serialized = unit.toObject();
      serialized.title = selectDisplayUnitTitle(indexedUnit?.title, serialized.title, book.title, unit.unitNumber);
      return serialized;
    }));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing archived units.' });
  }
}

export async function listPublicUnitsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: bookId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const units = await BookContent.find({ bookId })
      .select('unitNumber title sourceUrl scrapedAt')
      .sort({ unitNumber: 1 });
    const unitIndexByNumber = new Map((book.translatedUnitsList || []).map((unit) => [unit.unitNumber, unit]));

    return reply.send(units.map((unit) => {
      const indexedUnit = unitIndexByNumber.get(unit.unitNumber);
      const serialized = unit.toObject();
      serialized.title = selectDisplayUnitTitle(indexedUnit?.title, serialized.title, book.title, unit.unitNumber);
      return serialized;
    }));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing public units.' });
  }
}

export async function getUnitHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId, unitNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedUnitNumber = parseInt(unitNumber, 10);
  if (isNaN(parsedUnitNumber)) {
    return reply.status(400).send({ error: 'Invalid unit number.' });
  }

  try {
    const book = await findUserLibraryBook(bookId, userId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found or unauthorized.' });
    }

    // Retrieve full unit contents including the content body
    const unit = await BookContent.findOne({ bookId, unitNumber: parsedUnitNumber });
    if (!unit) {
      return reply.status(404).send({ error: `Unit ${parsedUnitNumber} has not been scraped/archived yet.` });
    }

    const indexedUnit = (book.translatedUnitsList || []).find((item) => item.unitNumber === unit.unitNumber);
    const serialized = unit.toObject();
    serialized.title = selectDisplayUnitTitle(indexedUnit?.title, serialized.title, book.title, unit.unitNumber);

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching unit content.' });
  }
}

export async function listRawUnitsHandler(request: FastifyRequest, reply: FastifyReply) {
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

    const units = await RawBookContent.find({ bookId })
      .select('unitNumber title sourceUrl language scrapedAt')
      .sort({ unitNumber: 1 });
    const unitIndexByNumber = new Map((book.rawUnitsList || []).map((unit) => [unit.unitNumber, unit]));

    return reply.send(units.map((unit) => {
      const indexedUnit = unitIndexByNumber.get(unit.unitNumber);
      const serialized = unit.toObject();
      serialized.title = selectDisplayUnitTitle(indexedUnit?.title, serialized.title, book.title, unit.unitNumber);
      return serialized;
    }));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing archived raw units.' });
  }
}

export async function listPublicRawUnitsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: bookId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const units = await RawBookContent.find({ bookId })
      .select('unitNumber title sourceUrl language scrapedAt')
      .sort({ unitNumber: 1 });
    const unitIndexByNumber = new Map((book.rawUnitsList || []).map((unit) => [unit.unitNumber, unit]));

    return reply.send(units.map((unit) => {
      const indexedUnit = unitIndexByNumber.get(unit.unitNumber);
      const serialized = unit.toObject();
      serialized.title = selectDisplayUnitTitle(indexedUnit?.title, serialized.title, book.title, unit.unitNumber);
      return serialized;
    }));
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing public raw units.' });
  }
}

export async function getRawUnitHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId, unitNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedUnitNumber = Number.parseInt(unitNumber, 10);
  if (Number.isNaN(parsedUnitNumber)) {
    return reply.status(400).send({ error: 'Invalid unit number.' });
  }

  try {
    const book = await findUserLibraryBook(bookId, userId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found or unauthorized.' });
    }

    const unit = await RawBookContent.findOne({ bookId, unitNumber: parsedUnitNumber });
    if (!unit) {
      return reply.status(404).send({ error: `Raw unit ${parsedUnitNumber} has not been archived yet.` });
    }

    const indexedUnit = (book.rawUnitsList || []).find((item) => item.unitNumber === unit.unitNumber);
    const serialized = unit.toObject();
    serialized.title = selectDisplayUnitTitle(indexedUnit?.title, serialized.title, book.title, unit.unitNumber);

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching raw unit content.' });
  }
}

export async function getPublicRawUnitHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: bookId, unitNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedUnitNumber = Number.parseInt(unitNumber, 10);
  if (Number.isNaN(parsedUnitNumber)) {
    return reply.status(400).send({ error: 'Invalid unit number.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const unit = await RawBookContent.findOne({ bookId, unitNumber: parsedUnitNumber });
    if (!unit) {
      return reply.status(404).send({ error: `Raw unit ${parsedUnitNumber} has not been archived yet.` });
    }

    const indexedUnit = (book.rawUnitsList || []).find((item) => item.unitNumber === unit.unitNumber);
    const serialized = unit.toObject();
    serialized.title = selectDisplayUnitTitle(indexedUnit?.title, serialized.title, book.title, unit.unitNumber);

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching public raw unit.' });
  }
}

export async function translateRawUnitHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: bookId, unitNumber } = request.params as any;
  const { targetLanguage, overwrite } = (request.body || {}) as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedUnitNumber = Number.parseInt(unitNumber, 10);
  if (Number.isNaN(parsedUnitNumber)) {
    return reply.status(400).send({ error: 'Invalid unit number.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.UNITS_TRANSLATE))) {
      return reply.status(403).send({ error: 'Admin access is required to generate and store translated units.' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const rawUnit = await RawBookContent.findOne({ bookId, unitNumber: parsedUnitNumber });
    if (!rawUnit) {
      return reply.status(404).send({ error: `Raw unit ${parsedUnitNumber} has not been archived yet.` });
    }

    const existingTranslated = await BookContent.findOne({ bookId, unitNumber: parsedUnitNumber });
    if (existingTranslated && !overwrite) {
      return reply.send({
        success: true,
        message: `Translated unit ${parsedUnitNumber} already exists.`,
        unit: existingTranslated,
        reusedExisting: true,
      });
    }

    request.log.info(`[translateRawUnit] starting unit ${parsedUnitNumber} for book ${bookId} targetLanguage=${targetLanguage || 'default'} overwrite=${Boolean(overwrite)}`);

    const translated = await translateUnitHtml({
      html: rawUnit.content,
      title: rawUnit.title,
      sourceLanguage: rawUnit.language || book.rawOriginalLanguage,
      targetLanguage,
      logger: request.log,
    });

    request.log.info(`[translateRawUnit] completed unit ${parsedUnitNumber} model=${translated.model} title="${translated.title}" contentLength=${translated.content.length}`);

    const unit = await BookContent.findOneAndUpdate(
      {
        bookId,
        unitNumber: parsedUnitNumber,
      },
      {
        $set: {
          bookId,
          unitNumber: parsedUnitNumber,
          title: translated.title,
          content: translated.content,
          sourceUrl: rawUnit.sourceUrl,
          scrapedAt: new Date(),
        },
      },
      { new: true, upsert: true },
    );

    return reply.send({
      success: true,
      message: `Generated translated unit ${parsedUnitNumber}.`,
      unit,
      model: translated.model,
      reusedExisting: false,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error translating raw unit.' });
  }
}

export async function getPublicUnitHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: bookId, unitNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedUnitNumber = parseInt(unitNumber, 10);
  if (isNaN(parsedUnitNumber)) {
    return reply.status(400).send({ error: 'Invalid unit number.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const unit = await BookContent.findOne({ bookId, unitNumber: parsedUnitNumber });
    if (!unit) {
      return reply.status(404).send({ error: `Unit ${parsedUnitNumber} has not been archived yet.` });
    }

    const indexedUnit = (book.translatedUnitsList || []).find((item) => item.unitNumber === unit.unitNumber);
    const serialized = unit.toObject();
    serialized.title = selectDisplayUnitTitle(indexedUnit?.title, serialized.title, book.title, unit.unitNumber);

    return reply.send(serialized);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching public unit.' });
  }
}

export async function listBookVisitsHandler(request: FastifyRequest, reply: FastifyReply) {
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

    const visits = await BookVisit.find({ bookId, userId })
      .sort({ openedAt: -1 })
      .limit(safeLimit);

    return reply.send(visits);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing unit visits.' });
  }
}

export async function recordBookVisitHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id: bookId, unitNumber } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedUnitNumber = Number.parseInt(unitNumber, 10);
  if (Number.isNaN(parsedUnitNumber)) {
    return reply.status(400).send({ error: 'Invalid unit number.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const unit = await BookContent.findOne({ bookId, unitNumber: parsedUnitNumber })
      .select('unitNumber title sourceUrl');
    if (!unit) {
      return reply.status(404).send({ error: `Unit ${parsedUnitNumber} has not been scraped/archived yet.` });
    }

    const activeSession = await ReadingSession.findOne({
      bookId,
      userId,
      completed: false,
    }).sort({ startDate: -1 });

    const visit = await BookVisit.create({
      bookId: book._id,
      userId: new mongoose.Types.ObjectId(userId),
      sessionId: activeSession?._id,
      unitNumber: unit.unitNumber,
      unitType: 'chapter',
      unitTitle: unit.title || `Unit ${unit.unitNumber}`,
      sourceUrl: unit.sourceUrl || '',
      openedAt: new Date(),
    });

    await UserBook.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), bookId: book._id },
      {
        $setOnInsert: {
          status: 'reading',
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

    await UserBook.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), bookId: book._id },
      {
        $max: { unitsRead: parsedUnitNumber },
        $set: { lastVisitedUnitNumber: parsedUnitNumber, lastVisitedAt: new Date() },
      },
      { new: true }
    );

    return reply.status(201).send(visit);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error recording unit visit.' });
  }
}

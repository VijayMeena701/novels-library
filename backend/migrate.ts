/// <reference types="node" />
import 'dotenv/config';
import process from 'node:process';
import mongoose from 'mongoose';
import { renameChapterTerminology } from './migrate-chapters.js';
import { Book, normalizeFilterKey } from './src/models/Novel.js';
import { UserBook } from './src/models/UserNovel.js';
import { ChapterContent } from './src/models/ChapterContent.js';
import { RawChapterContent } from './src/models/RawChapterContent.js';
import { ChapterVisit } from './src/models/ChapterVisit.js';
import { Author } from './src/models/Author.js';
import { Genre } from './src/models/Genre.js';
import { PublicationStatus } from './src/models/PublicationStatus.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/novels-library';

interface ParsedAuthorBlob {
  authorNamesText: string;
  authorNames: string[];
  alternativeNames: string[];
  genres: string[];
  source: string;
  status: string;
}

function parseAuthorBlob(blob: string): ParsedAuthorBlob {
  const markers = [
    { key: 'alternativeNames', marker: 'Alternative names:' },
    { key: 'genres', marker: 'Genre:' },
    { key: 'source', marker: 'Source:' },
    { key: 'status', marker: 'Status:' },
  ] as const;

  const positions: { key: string; marker: string; pos: number; end: number }[] = [];
  for (const { key, marker } of markers) {
    const pos = blob.indexOf(marker);
    if (pos !== -1) {
      positions.push({ key, marker, pos, end: pos + marker.length });
    }
  }
  positions.sort((a, b) => a.pos - b.pos);

  const result: ParsedAuthorBlob = {
    authorNamesText: blob,
    authorNames: [],
    alternativeNames: [],
    genres: [],
    source: '',
    status: '',
  };

  let start = 0;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const segment = blob.substring(start, p.pos).trim();
    const nextPos = i < positions.length - 1 ? positions[i + 1].pos : blob.length;
    const value = blob.substring(p.end, nextPos).trim();

    if (i === 0) {
      result.authorNamesText = segment;
    }

    if (p.key === 'alternativeNames') result.alternativeNames = value.split(',').map((s) => s.trim()).filter(Boolean);
    if (p.key === 'genres') result.genres = value.split(',').map((s) => s.trim()).filter(Boolean);
    if (p.key === 'source') result.source = value;
    if (p.key === 'status') result.status = value;

    start = p.end;
  }

  result.authorNames = result.authorNamesText.split(',').map((s) => s.trim()).filter(Boolean);
  return result;
}

function isAuthorBlob(blob: string): boolean {
  return /Alternative names:|Genre:|Source:|Status:/.test(blob);
}

function extractMetadata(oldNovel: any) {
  if (isAuthorBlob(oldNovel.author || '')) {
    const parsed = parseAuthorBlob(oldNovel.author || '');
    return {
      author: parsed.authorNames[0] || '',
      authorPenName: parsed.authorNames[1] || '',
      authorRealName: parsed.authorNames[2] || '',
      alternativeNames: parsed.alternativeNames,
      genres: parsed.genres,
      originalSource: parsed.source,
      publicationStatus: parsed.status,
    };
  }

  return {
    author: oldNovel.author || '',
    authorPenName: oldNovel.authorPenName || '',
    authorRealName: oldNovel.authorRealName || '',
    alternativeNames: oldNovel.alternativeNames || [],
    genres: oldNovel.genres || [],
    originalSource: oldNovel.originalSource || '',
    publicationStatus: oldNovel.publicationStatus || '',
  };
}

async function getOrCreateAuthor(name: string, alternativeNames: string[]) {
  const displayName = name || 'Unknown Author';
  let author = await Author.findOne({ displayName });
  if (!author) {
    author = new Author({
      displayName,
      alternativeNames,
      originalLanguage: '',
    });
    await author.save();
    return { author, created: true };
  }
  return { author, created: false };
}

async function getOrCreateGenre(name: string) {
  const key = normalizeFilterKey(name);
  let genre = await Genre.findOne({ key });
  if (!genre) {
    genre = new Genre({ name, key });
    await genre.save();
    return { genre, created: true };
  }
  return { genre, created: false };
}

async function getOrCreatePublicationStatus(name: string) {
  const key = normalizeFilterKey(name);
  let status = await PublicationStatus.findOne({ key });
  if (!status) {
    status = new PublicationStatus({ name, key });
    await status.save();
    return { status, created: true };
  }
  return { status, created: false };
}

function mapChapterList(list: any[] | undefined): { title: string; url: string; chapterNumber: number; chapterType: string }[] {
  return (list || []).map((c) => ({
    title: c.title || '',
    url: c.url || '',
    chapterNumber: c.number || 0,
    chapterType: 'chapter',
  }));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function migrateLegacyBookUserIds(db: any) {
  const booksColl = db.collection('books');
  const legacyBooks = await booksColl.find({ userId: { $exists: true, $ne: null } }).toArray();
  let userBooksCreated = 0;
  let booksCleaned = 0;

  for (const book of legacyBooks) {
    const userId = book.userId;
    const bookId = book._id;
    const addedByUserId = book.addedByUserId || userId;

    const existingUserBook = await UserBook.findOne({ userId, bookId });
    if (!existingUserBook) {
      const chaptersRead = book.chaptersRead ?? book.unitsRead ?? 0;
      const personalTags = Array.isArray(book.personalTags) ? book.personalTags : [];
      await UserBook.create({
        userId,
        bookId,
        status: book.status || 'planning',
        chaptersRead,
        rating: book.rating || 0,
        review: book.review || '',
        personalNotes: book.personalNotes || '',
        rawLegacyEntry: book.rawLegacyEntry || JSON.stringify({
          _id: bookId,
          title: book.title,
          userId,
          status: book.status,
          chaptersRead: book.chaptersRead,
          unitsRead: book.unitsRead,
          rating: book.rating,
          review: book.review,
          personalNotes: book.personalNotes,
          completedAt: book.completedAt,
          updatedAt: book.updatedAt,
          createdAt: book.createdAt,
        }),
        characterNotes: book.characterNotes || '',
        relationshipNotes: book.relationshipNotes || '',
        personalTags,
        completedAt: book.completedAt || null,
        lastVisitedChapterNumber: chaptersRead,
        lastVisitedAt: chaptersRead ? (book.updatedAt || new Date()) : null,
        createdAt: book.createdAt || new Date(),
        updatedAt: book.updatedAt || new Date(),
      });
      userBooksCreated++;
    }

    await booksColl.updateOne(
      { _id: bookId },
      { $set: { addedByUserId }, $unset: { userId: 1 } }
    );
    booksCleaned++;
  }

  console.log(`Legacy book userId cleanup: ${booksCleaned} books cleaned, ${userBooksCreated} user books created.`);
}

async function dropLegacyCollections(db: any) {
  const legacyCollections = ['novels', 'usernovels', 'chaptercontents', 'rawchaptercontents', 'chaptervisits'];
  for (const name of legacyCollections) {
    try {
      await db.collection(name).drop();
      console.log(`Dropped legacy collection: ${name}`);
    } catch (err: any) {
      if (err.code !== 26 && err.codeName !== 'NamespaceNotFound') {
        console.error(`Failed to drop legacy collection ${name}:`, err.message);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find((arg) => !arg.startsWith('--')) || 'legacy';
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db as any;

  if (mode === 'rename') {
    await renameChapterTerminology(db, dryRun, force);
    await mongoose.disconnect();
    return;
  }

  const oldNovels = await db.collection('novels').find().toArray();
  const oldUserNovels = await db.collection('usernovels').find().toArray();
  const oldChapters = await db.collection('chaptercontents').find().toArray();
  const oldRawChapters = await db.collection('rawchaptercontents').find().toArray();
  const oldVisits = await db.collection('chaptervisits').find().toArray();

  const chaptersByNovel = new Map<string, any[]>();
  for (const ch of oldChapters) {
    const novelId = String(ch.novelId);
    if (!chaptersByNovel.has(novelId)) chaptersByNovel.set(novelId, []);
    chaptersByNovel.get(novelId)!.push(ch);
  }

  const rawChaptersByNovel = new Map<string, any[]>();
  for (const ch of oldRawChapters) {
    const novelId = String(ch.novelId);
    if (!rawChaptersByNovel.has(novelId)) rawChaptersByNovel.set(novelId, []);
    rawChaptersByNovel.get(novelId)!.push(ch);
  }

  const visitsByNovel = new Map<string, any[]>();
  for (const v of oldVisits) {
    const novelId = String(v.novelId);
    if (!visitsByNovel.has(novelId)) visitsByNovel.set(novelId, []);
    visitsByNovel.get(novelId)!.push(v);
  }

  const userNovelsByNovel = new Map<string, any[]>();
  for (const un of oldUserNovels) {
    const novelId = String(un.novelId);
    if (!userNovelsByNovel.has(novelId)) userNovelsByNovel.set(novelId, []);
    userNovelsByNovel.get(novelId)!.push(un);
  }

  const stats = {
    books: 0,
    userBooks: 0,
    bookContents: 0,
    rawChapterContents: 0,
    bookVisits: 0,
    authors: 0,
    genres: 0,
    publicationStatuses: 0,
    skipped: 0,
  };

  for (const oldNovel of oldNovels) {
    const existing = oldNovel.sourceUrl
      ? await Book.findOne({ sourceUrl: oldNovel.sourceUrl })
      : await Book.findOne({ title: oldNovel.title });
    if (existing) {
      console.log(`Skipping already migrated novel: ${oldNovel.title}`);
      stats.skipped++;
    }

    const metadata = extractMetadata(oldNovel);
    let authorId = oldNovel.authorId || null;
    let authorIds: any[] = oldNovel.authorIds || [];
    if (!authorIds.length && authorId) authorIds = [authorId];
    if (!authorIds.length) {
      const authorAlts = [metadata.authorPenName, metadata.authorRealName].filter(Boolean);
      const authorName = metadata.author || metadata.authorPenName || metadata.authorRealName || 'Unknown Author';
      const { author, created } = await getOrCreateAuthor(authorName, authorAlts);
      if (created) stats.authors++;
      authorId = author._id;
      authorIds = [author._id];
    } else if (!authorId && authorIds.length) {
      authorId = authorIds[0];
    }

    let genreIds: any[] = oldNovel.genreIds || [];
    let genres: string[] = metadata.genres;
    if (!genreIds.length && genres.length) {
      for (const g of genres) {
        const { genre, created } = await getOrCreateGenre(g);
        if (created) stats.genres++;
        genreIds.push(genre._id);
      }
    } else if (!genres.length && genreIds.length) {
      const foundGenres = await Genre.find({ _id: { $in: genreIds } });
      genres = foundGenres.map((g) => g.name);
    }

    let publicationStatusId = oldNovel.publicationStatusId || null;
    let publicationStatus = metadata.publicationStatus;
    if (!publicationStatusId && publicationStatus) {
      const { status: ps, created } = await getOrCreatePublicationStatus(publicationStatus);
      if (created) stats.publicationStatuses++;
      publicationStatusId = ps._id;
    }

    const translatedChaptersList = mapChapterList(oldNovel.chaptersList);
    const translatedChaptersTotal = oldNovel.chaptersTotal || translatedChaptersList.length;
    const rawChaptersList = mapChapterList(oldNovel.rawChaptersList);
    const rawChaptersTotal = oldNovel.rawChaptersTotal || rawChaptersList.length;

    let book: any;
    if (existing) {
      book = existing;
    } else {
      book = new Book({
        addedByUserId: oldNovel.addedByUserId || oldNovel.userId || null,
        mediaType: 'novel',
        authorId,
        authorIds,
        title: oldNovel.title || '',
        author: metadata.author,
        authorPenName: metadata.authorPenName,
        authorRealName: metadata.authorRealName,
        alternativeNames: metadata.alternativeNames,
        genreIds,
        genres,
        originalSource: metadata.originalSource,
        publicationStatusId,
        publicationStatus,
        description: oldNovel.description || '',
        coverUrl: oldNovel.coverUrl || '',
        coverImagePath: oldNovel.coverImagePath || '',
        coverImageMimeType: oldNovel.coverImageMimeType || '',
        coverImageSize: oldNovel.coverImageSize || 0,
        coverImageToken: oldNovel.coverImageToken || '',
        coverImageSyncedAt: oldNovel.coverImageSyncedAt || null,
        sourceUrl: oldNovel.sourceUrl || '',
        rawSourceUrl: oldNovel.rawSourceUrl || '',
        rawOriginalLanguage: oldNovel.rawOriginalLanguage || '',
        rawChaptersTotal,
        rawChaptersList,
        status: oldNovel.status || 'planning',
        translatedChaptersTotal,
        translatedChaptersList,
        createdAt: oldNovel.createdAt,
        updatedAt: oldNovel.updatedAt,
      });
      await book.save();
      stats.books++;
    }

    const bookId = book._id;
    const userNovels = userNovelsByNovel.get(String(oldNovel._id)) || [];
    if (userNovels.length) {
      for (const un of userNovels) {
        const personalTags = Array.isArray(un.personalTags) ? un.personalTags : [];
        await UserBook.updateOne(
          { userId: un.userId, bookId },
          {
            $setOnInsert: {
              userId: un.userId,
              bookId,
              status: un.status || 'planning',
              chaptersRead: un.chaptersRead ?? un.unitsRead ?? 0,
              rating: un.rating || 0,
              review: un.review || '',
              personalNotes: un.personalNotes || '',
              rawLegacyEntry: un.rawLegacyEntry || '',
              characterNotes: un.characterNotes || '',
              relationshipNotes: un.relationshipNotes || '',
              personalTags,
              personalTagKeys: personalTags.map((tag: string) => normalizeFilterKey(tag)).filter(Boolean),
              completedAt: un.completedAt || null,
              lastVisitedChapterNumber: un.chaptersRead ?? un.unitsRead ?? 0,
              lastVisitedAt: un.chaptersRead ? un.updatedAt : null,
              createdAt: un.createdAt,
              updatedAt: un.updatedAt,
            },
          },
          { upsert: true, timestamps: false }
        );
        stats.userBooks++;
      }
    } else if (oldNovel.userId) {
      const personalTags = Array.isArray(oldNovel.personalTags) ? oldNovel.personalTags : [];
      await UserBook.updateOne(
        { userId: oldNovel.userId, bookId },
        {
          $setOnInsert: {
            userId: oldNovel.userId,
            bookId,
            status: oldNovel.status || 'planning',
            chaptersRead: oldNovel.chaptersRead ?? oldNovel.unitsRead ?? 0,
            rating: oldNovel.rating || 0,
            review: oldNovel.review || '',
            personalNotes: oldNovel.personalNotes || '',
            rawLegacyEntry: oldNovel.rawLegacyEntry || JSON.stringify({
              _id: oldNovel._id,
              title: oldNovel.title,
              status: oldNovel.status,
              chaptersTotal: oldNovel.chaptersTotal,
              chaptersRead: oldNovel.chaptersRead,
              rating: oldNovel.rating,
              review: oldNovel.review,
              personalNotes: oldNovel.personalNotes,
            }),
            characterNotes: oldNovel.characterNotes || '',
            relationshipNotes: oldNovel.relationshipNotes || '',
            personalTags,
            personalTagKeys: personalTags.map((tag: string) => normalizeFilterKey(tag)).filter(Boolean),
            completedAt: oldNovel.completedAt || null,
            lastVisitedChapterNumber: oldNovel.chaptersRead ?? oldNovel.unitsRead ?? 0,
            lastVisitedAt: oldNovel.chaptersRead ? oldNovel.updatedAt : null,
            createdAt: oldNovel.createdAt,
            updatedAt: oldNovel.updatedAt,
          },
        },
        { upsert: true, timestamps: false }
      );
      stats.userBooks++;
    }

    const chapters = chaptersByNovel.get(String(oldNovel._id)) || [];
    const chapterOps = chapters.map((ch) => {
      const chapterNumber = ch.chapterNumber || 0;
      const titleFromList = translatedChaptersList.find((u) => u.chapterNumber === chapterNumber)?.title || '';
      const title = titleFromList || ch.title || '';
      return {
        updateOne: {
          filter: { bookId, chapterNumber },
          update: {
            $set: {
              bookId,
              chapterNumber,
              chapterType: 'chapter',
              title,
              content: ch.content || '',
              sourceUrl: ch.sourceUrl || '',
              scrapedAt: ch.scrapedAt || new Date(),
            },
          },
          upsert: true,
        },
      };
    });
    for (const batch of chunk(chapterOps, 1000)) {
      await ChapterContent.bulkWrite(batch);
    }
    stats.bookContents += chapters.length;

    const rawChapters = rawChaptersByNovel.get(String(oldNovel._id)) || [];
    const rawOps = rawChapters.map((ch) => {
      const chapterNumber = ch.chapterNumber || 0;
      const titleFromList = rawChaptersList.find((u) => u.chapterNumber === chapterNumber)?.title || '';
      const title = titleFromList || ch.title || '';
      return {
        updateOne: {
          filter: { bookId, chapterNumber },
          update: {
            $set: {
              bookId,
              chapterNumber,
              chapterType: 'chapter',
              title,
              content: ch.content || '',
              language: ch.language || '',
              sourceUrl: ch.sourceUrl || '',
              scrapedAt: ch.scrapedAt || new Date(),
            },
          },
          upsert: true,
        },
      };
    });
    for (const batch of chunk(rawOps, 1000)) {
      await RawChapterContent.bulkWrite(batch);
    }
    stats.rawChapterContents += rawChapters.length;

    const visits = visitsByNovel.get(String(oldNovel._id)) || [];
    const visitOps = visits.map((v) => {
      const chapterNumber = v.chapterNumber || 0;
      const titleFromList = translatedChaptersList.find((u) => u.chapterNumber === chapterNumber)?.title || '';
      const chapterTitle = v.chapterTitle || titleFromList || '';
      return {
        updateOne: {
          filter: { bookId, userId: v.userId, chapterNumber, openedAt: v.openedAt },
          update: {
            $setOnInsert: {
              bookId,
              userId: v.userId,
              chapterNumber,
              chapterType: 'chapter',
              chapterTitle,
              sourceUrl: v.sourceUrl || '',
              openedAt: v.openedAt || new Date(),
            },
          },
          upsert: true,
        },
      };
    });
    for (const batch of chunk(visitOps, 1000)) {
      await ChapterVisit.bulkWrite(batch);
    }
    stats.bookVisits += visits.length;

    console.log(`Migrated: ${book.title} (chapters: ${chapters.length}, raw: ${rawChapters.length}, visits: ${visits.length})`);
  }

  await migrateLegacyBookUserIds(db);
  await dropLegacyCollections(db);

  console.log('Migration stats:', stats);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

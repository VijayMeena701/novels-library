import { BackgroundJob } from '../models/BackgroundJob.js';
import { ChapterContent } from '../models/ChapterContent.js';
import { RawChapterContent } from '../models/RawChapterContent.js';
import { resolveAuthorIds } from './authors.js';
import { syncNovelCoverImage } from './coverImage.js';
import { ManualInterventionRequiredError, ScrapedMetadata, ScraperService } from './scraper.js';
import { resolveGenres, resolvePublicationStatus } from './taxonomy.js';

export type SourceKind = 'translated' | 'raw';

type ChapterIndex = ScrapedMetadata['chapters'][number];

export interface ArchiveProgress {
  current: number;
  total: number;
  message: string;
}

export interface ArchiveMetadataResult {
  sourceKind: SourceKind;
  chaptersFound: number;
  title: string;
}

export interface ArchiveChaptersResult {
  sourceKind: SourceKind;
  total: number;
  alreadyArchived: number;
  archived: number;
  pending: number;
  suspended: boolean;
}

export interface ImportedChapterResult {
  sourceKind: SourceKind;
  chapterNumber: number;
  title: string;
  sourceUrl: string;
}

export function isManualInterventionError(
  error: any,
): error is ManualInterventionRequiredError & { chapterNumber?: number; sourceKind?: SourceKind } {
  return error?.code === 'MANUAL_INTERVENTION_REQUIRED';
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isGenericChapterTitle(value: string, novelTitle: string, chapterNumber: number): boolean {
  const normalized = normalizeTitle(value);
  if (!normalized) {
    return true;
  }

  return (
    normalized === normalizeTitle(novelTitle) ||
    normalized === `chapter ${chapterNumber}` ||
    normalized === `ch ${chapterNumber}`
  );
}

function selectChapterTitle(indexedTitle: string, scrapedTitle: string, novelTitle: string, chapterNumber: number): string {
  const cleanIndexedTitle = indexedTitle?.replace(/\s+/g, ' ').trim() || '';
  const cleanScrapedTitle = scrapedTitle?.replace(/\s+/g, ' ').trim() || '';

  if (cleanIndexedTitle && !isGenericChapterTitle(cleanIndexedTitle, novelTitle, chapterNumber)) {
    return cleanIndexedTitle;
  }

  if (cleanScrapedTitle && !isGenericChapterTitle(cleanScrapedTitle, novelTitle, chapterNumber)) {
    return cleanScrapedTitle;
  }

  return cleanIndexedTitle || cleanScrapedTitle || `Chapter ${chapterNumber}`;
}

function sourceLabel(sourceKind: SourceKind): string {
  return sourceKind === 'raw' ? 'raw' : 'translated';
}

function getSourceUrl(novel: any, sourceKind: SourceKind): string {
  return String(sourceKind === 'raw' ? novel.rawSourceUrl || '' : novel.sourceUrl || '').trim();
}

function getChapterList(novel: any, sourceKind: SourceKind): ChapterIndex[] {
  return sourceKind === 'raw' ? novel.rawChaptersList || [] : novel.chaptersList || [];
}

function getContentModel(sourceKind: SourceKind): any {
  return sourceKind === 'raw' ? RawChapterContent : ChapterContent;
}

function uniqueValidChapters(chaptersList: ChapterIndex[], sourceKind: SourceKind): ChapterIndex[] {
  const seenChapterNumbers = new Set<number>();

  return chaptersList.filter((chapter: any) => {
    const chapterNumber = Number(chapter.number);
    if (!Number.isFinite(chapterNumber) || seenChapterNumbers.has(chapterNumber) || !isHttpUrl(chapter.url)) {
      if (chapter.url && !isHttpUrl(chapter.url)) {
        console.warn(`[Archive] Skipping ${sourceLabel(sourceKind)} chapter ${chapter.number || '?'} with invalid URL: ${chapter.url}`);
      }
      return false;
    }

    seenChapterNumbers.add(chapterNumber);
    return true;
  });
}

function makeChapterScrapeError(
  chapter: ChapterIndex,
  sourceKind: SourceKind,
  error: any,
): Error & { code: string; url: string; chapterNumber: number; sourceKind: SourceKind } {
  const label = sourceKind === 'raw' ? 'Raw Chapter' : 'Chapter';
  const message = `Failed on ${label} ${chapter.number} at ${chapter.url}: ${error.message || 'Unknown error'}`;
  const wrapped = new Error(message) as Error & {
    code: string;
    url: string;
    chapterNumber: number;
    sourceKind: SourceKind;
  };

  wrapped.stack = error.stack;
  wrapped.code = error.code === 'MANUAL_INTERVENTION_REQUIRED' ? 'MANUAL_INTERVENTION_REQUIRED' : 'CHAPTER_SCRAPE_FAILED';
  wrapped.url = chapter.url;
  wrapped.chapterNumber = Number(chapter.number);
  wrapped.sourceKind = sourceKind;
  return wrapped;
}

async function repairExistingChapterTitles(novel: any, sourceKind: SourceKind, uniqueChapters: ChapterIndex[]) {
  const ContentModel = getContentModel(sourceKind);
  const existingChapters = await ContentModel.find({
    novelId: novel._id,
    chapterNumber: { $in: uniqueChapters.map((chapter) => chapter.number) },
  }).select('chapterNumber title');
  const chapterIndexByNumber = new Map<number, ChapterIndex>(uniqueChapters.map((chapter) => [chapter.number, chapter]));
  const titleRepairOperations = existingChapters.flatMap((chapter: any) => {
    const indexedChapter = chapterIndexByNumber.get(chapter.chapterNumber);
    if (!indexedChapter) {
      return [];
    }

    const nextTitle = selectChapterTitle(indexedChapter.title, chapter.title, novel.title, chapter.chapterNumber);
    if (nextTitle !== chapter.title && isGenericChapterTitle(chapter.title, novel.title, chapter.chapterNumber)) {
      return [{
        updateOne: {
          filter: { _id: chapter._id },
          update: { $set: { title: nextTitle } },
        },
      }];
    }

    return [];
  });

  if (titleRepairOperations.length > 0) {
    await ContentModel.bulkWrite(titleRepairOperations);
    console.log(`[Archive] Repaired ${titleRepairOperations.length} ${sourceLabel(sourceKind)} chapter title(s) from chapter index.`);
  }

  return existingChapters;
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class NovelArchiveService {
  static async scrapeMetadata(
    novel: any,
    sourceKind: SourceKind,
    options: { syncCover?: boolean; requireChapters?: boolean } = {},
  ): Promise<ArchiveMetadataResult> {
    const sourceUrl = getSourceUrl(novel, sourceKind);
    if (!sourceUrl) {
      throw new Error(`Novel ${sourceKind === 'raw' ? 'rawSourceUrl' : 'sourceUrl'} is empty. Cannot scrape ${sourceLabel(sourceKind)} metadata.`);
    }

    const scraped = await ScraperService.scrapeMetadata(sourceUrl);
    return this.applyMetadata(novel, sourceKind, scraped, {
      ...options,
      sourceUrl,
      requireChapters: options.requireChapters ?? sourceKind === 'raw',
    });
  }

  static async importMetadataHtml(
    novel: any,
    sourceKind: SourceKind,
    html: string,
    pageUrl: string,
  ): Promise<ArchiveMetadataResult> {
    const parsedPageUrl = new URL(pageUrl).toString();
    const scraped = await ScraperService.scrapeMetadataFromHtml(html, parsedPageUrl);
    return this.applyMetadata(novel, sourceKind, scraped, {
      sourceUrl: parsedPageUrl,
      requireChapters: true,
    });
  }

  private static async applyMetadata(
    novel: any,
    sourceKind: SourceKind,
    scraped: ScrapedMetadata,
    options: { sourceUrl: string; syncCover?: boolean; requireChapters?: boolean },
  ): Promise<ArchiveMetadataResult> {
    if (options.requireChapters && scraped.chapters.length === 0) {
      throw new Error(
        `${sourceKind === 'raw' ? 'Raw' : 'Translated'} metadata scraper found 0 chapters. The site may be blocking Puppeteer, the pasted HTML may not be the catalogue page, or the catalogue pattern is unsupported.`,
      );
    }

    if (sourceKind === 'raw') {
      novel.rawChaptersList = scraped.chapters;
      novel.rawChaptersTotal = scraped.chapters.length;
      if (!novel.rawSourceUrl) {
        novel.rawSourceUrl = options.sourceUrl;
      }
      if (!novel.rawOriginalLanguage && scraped.originalSource) {
        novel.rawOriginalLanguage = scraped.originalSource;
      }
      await novel.save();
      return { sourceKind, chaptersFound: scraped.chapters.length, title: novel.title };
    }

    if (scraped.title && scraped.title !== 'Unknown Novel' && (!novel.title || novel.title === 'Pending Scrape')) {
      novel.title = scraped.title;
    }
    if (scraped.author && scraped.author !== 'Unknown Author' && !novel.author) {
      novel.author = scraped.author;
    }
    if (scraped.authorPenName && !novel.authorPenName) {
      novel.authorPenName = scraped.authorPenName;
    }
    if (scraped.authorRealName && !novel.authorRealName) {
      novel.authorRealName = scraped.authorRealName;
    }
    if (scraped.alternativeNames?.length && (!novel.alternativeNames || novel.alternativeNames.length === 0)) {
      novel.alternativeNames = scraped.alternativeNames;
    }
    if (scraped.genres?.length && (!novel.genreIds || novel.genreIds.length === 0)) {
      const resolvedGenres = await resolveGenres({ genres: scraped.genres });
      novel.genreIds = resolvedGenres.genreIds;
      novel.genres = resolvedGenres.genres;
      novel.genreKeys = resolvedGenres.genreKeys;
    }
    if (scraped.originalSource && !novel.originalSource) {
      novel.originalSource = scraped.originalSource;
    }
    if (scraped.publicationStatus && !novel.publicationStatus) {
      const resolvedStatus = await resolvePublicationStatus({ publicationStatus: scraped.publicationStatus });
      novel.publicationStatusId = resolvedStatus.publicationStatusId;
      novel.publicationStatus = resolvedStatus.publicationStatus || scraped.publicationStatus;
      novel.publicationStatusKey = resolvedStatus.publicationStatusKey || '';
    }

    const linkedAuthorIds = await resolveAuthorIds({
      author: scraped.author,
      penName: scraped.authorPenName || scraped.author,
      realName: scraped.authorRealName,
      alternativeNames: [],
      officialUrl: options.sourceUrl,
      originalLanguage: novel.rawOriginalLanguage,
    });
    if (linkedAuthorIds.length > 0) {
      novel.authorIds = linkedAuthorIds;
      novel.authorId = linkedAuthorIds[0];
    }

    if (scraped.description && !novel.description) {
      novel.description = scraped.description;
    }
    if (scraped.coverUrl) {
      if (!novel.coverUrl) {
        novel.coverUrl = scraped.coverUrl;
      }

      if (options.syncCover) {
        try {
          await syncNovelCoverImage(novel, scraped.coverUrl);
        } catch (err: any) {
          console.warn(`[Archive] Cover image sync failed for novel ${novel._id}: ${err.message}`);
        }
      }
    }
    if (!novel.sourceUrl) {
      novel.sourceUrl = options.sourceUrl;
    }

    novel.chaptersList = scraped.chapters;
    novel.chaptersTotal = scraped.chapters.length;
    await novel.save();

    return { sourceKind, chaptersFound: scraped.chapters.length, title: novel.title };
  }

  static async archiveMissingChapters(
    novel: any,
    sourceKind: SourceKind,
    options: {
      limit?: number;
      chapterNumber?: number;
      concurrency?: number;
      delayMs?: number;
      shouldContinue?: () => boolean;
      onProgress?: (progress: ArchiveProgress) => Promise<void>;
    } = {},
  ): Promise<ArchiveChaptersResult> {
    const uniqueChapters = uniqueValidChapters(getChapterList(novel, sourceKind), sourceKind);
    const totalChapters = uniqueChapters.length;
    if (totalChapters === 0) {
      throw new Error(`No ${sourceLabel(sourceKind)} chapters listed on this novel. Run ${sourceLabel(sourceKind)} metadata indexing first.`);
    }

    const existingChapters = await repairExistingChapterTitles(novel, sourceKind, uniqueChapters);
    const existingChapterNumbers = new Set(existingChapters.map((chapter: any) => chapter.chapterNumber));
    const pendingChapters = uniqueChapters.filter((chapter) => !existingChapterNumbers.has(chapter.number));
    const selectedPendingChapters = options.chapterNumber
      ? pendingChapters.filter((chapter) => chapter.number === options.chapterNumber)
      : pendingChapters;
    if (options.chapterNumber && selectedPendingChapters.length === 0 && !existingChapterNumbers.has(options.chapterNumber)) {
      throw new Error(`${sourceKind === 'raw' ? 'Raw chapter' : 'Chapter'} ${options.chapterNumber} is not present in the indexed chapter list.`);
    }
    const requestedLimit = Number.isFinite(options.limit) ? Math.max(1, Number(options.limit)) : selectedPendingChapters.length;
    const chaptersToArchive = selectedPendingChapters.slice(0, requestedLimit);
    const workerCount = Math.min(Math.max(1, options.concurrency || 1), chaptersToArchive.length || 1);
    const ContentModel = getContentModel(sourceKind);
    let completedCount = existingChapterNumbers.size;
    let archivedCount = 0;
    let nextChapterIndex = 0;
    let firstError: Error | null = null;
    let suspended = false;

    await options.onProgress?.({
      current: completedCount,
      total: totalChapters,
      message: `Skipped ${completedCount} already archived ${sourceLabel(sourceKind)} chapters. Processing ${chaptersToArchive.length} missing chapters now...`,
    });

    async function archiveWorker(workerIndex: number) {
      while (!firstError) {
        if (options.shouldContinue && !options.shouldContinue()) {
          suspended = true;
          return;
        }

        const chapter = chaptersToArchive[nextChapterIndex++];
        if (!chapter) {
          return;
        }

        console.log(
          `[Archive] [${workerIndex + 1}/${workerCount}] Scraping ${sourceLabel(sourceKind)} chapter ${chapter.number}/${totalChapters}: ${chapter.title}`,
        );

        try {
          const scrapedChapter = await ScraperService.scrapeChapter(chapter.url);
          const chapterTitle = selectChapterTitle(chapter.title, scrapedChapter.title, novel.title, chapter.number);
          const $setOnInsert: Record<string, any> = {
            novelId: novel._id,
            chapterNumber: chapter.number,
            title: chapterTitle,
            content: scrapedChapter.content,
            sourceUrl: chapter.url,
            scrapedAt: new Date(),
          };
          if (sourceKind === 'raw') {
            $setOnInsert.language = novel.rawOriginalLanguage || '';
          }

          const result = await ContentModel.updateOne(
            {
              novelId: novel._id,
              chapterNumber: chapter.number,
            },
            { $setOnInsert },
            { upsert: true },
          );

          if (result.upsertedCount > 0) {
            archivedCount++;
            completedCount++;
          }

          await options.onProgress?.({
            current: completedCount,
            total: totalChapters,
            message: `Saved ${sourceLabel(sourceKind)} chapter ${chapter.number}: ${chapterTitle}`,
          });

          await sleep(options.delayMs || 0);
        } catch (err: any) {
          console.error(`[Archive] Error scraping ${sourceLabel(sourceKind)} chapter ${chapter.number} (${chapter.url}):`, err.message);
          firstError = makeChapterScrapeError(chapter, sourceKind, err);
          return;
        }
      }
    }

    await Promise.all(Array.from({ length: workerCount }, (_, index) => archiveWorker(index)));

    if (firstError) {
      throw firstError;
    }

    return {
      sourceKind,
      total: totalChapters,
      alreadyArchived: existingChapterNumbers.size,
      archived: archivedCount,
      pending: Math.max(0, pendingChapters.length - archivedCount),
      suspended,
    };
  }

  static async importChapterHtml(
    novel: any,
    sourceKind: SourceKind,
    chapterNumber: number,
    html: string,
    pageUrl: string,
  ): Promise<ImportedChapterResult> {
    const parsedPageUrl = new URL(pageUrl).toString();
    const scrapedChapter = await ScraperService.scrapeChapterFromHtml(html, parsedPageUrl);
    const indexedChapter = getChapterList(novel, sourceKind)
      .find((chapter) => Number(chapter.number) === chapterNumber);
    const chapterTitle = selectChapterTitle(
      indexedChapter?.title || '',
      scrapedChapter.title,
      novel.title,
      chapterNumber,
    );
    const ContentModel = getContentModel(sourceKind);
    const $set: Record<string, any> = {
      novelId: novel._id,
      chapterNumber,
      title: chapterTitle,
      content: scrapedChapter.content,
      sourceUrl: parsedPageUrl,
      scrapedAt: new Date(),
    };
    if (sourceKind === 'raw') {
      $set.language = novel.rawOriginalLanguage || '';
    }

    await ContentModel.updateOne(
      {
        novelId: novel._id,
        chapterNumber,
      },
      { $set },
      { upsert: true },
    );

    return {
      sourceKind,
      chapterNumber,
      title: chapterTitle,
      sourceUrl: parsedPageUrl,
    };
  }

  static async recordDirectJobFailure(job: any, error: any) {
    if (isManualInterventionError(error)) {
      job.status = 'requires_manual_intervention';
      job.failedAt = new Date();
      job.error = {
        message: error.message || 'Manual intervention is required.',
        stack: error.stack,
        code: error.code,
        url: error.url,
        chapterNumber: error.chapterNumber,
        sourceKind: error.sourceKind,
      };
      job.progress = {
        current: job.progress?.current || 0,
        total: job.progress?.total || 1,
        message: 'Manual browser clearance is required before this task can continue.',
      };
      await job.save();
      return;
    }

    job.status = 'failed';
    job.failedAt = new Date();
    job.error = {
      message: error.message || 'Unknown error occurred.',
      stack: error.stack,
      code: error.code,
      url: error.url,
      chapterNumber: error.chapterNumber,
      sourceKind: error.sourceKind,
    };
    await job.save();
  }

  static async createCompletedImportJob(
    novel: any,
    userId: string,
    type: 'scrape_metadata' | 'scrape_raw_metadata',
    message: string,
  ) {
    return BackgroundJob.create({
      novelId: novel._id,
      userId,
      type,
      status: 'completed',
      completedAt: new Date(),
      progress: {
        current: 1,
        total: 1,
        message,
      },
    });
  }
}

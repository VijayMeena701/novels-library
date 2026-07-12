import { BackgroundJob } from '../models/BackgroundJob.js';
import { BookContent } from '../models/ChapterContent.js';
import { RawBookContent } from '../models/RawChapterContent.js';
import { resolveAuthorIds } from './authors.js';
import { syncBookCoverImage } from './coverImage.js';
import { ManualInterventionRequiredError, ScrapedMetadata, ScraperService } from './scraper.js';
import { resolveGenres, resolvePublicationStatus } from './taxonomy.js';

export type SourceKind = 'translated' | 'raw';

type UnitIndex = {
  title: string;
  url: string;
  number: number;
  unitType?: string;
};

export interface ArchiveProgress {
  current: number;
  total: number;
  message: string;
}

export interface ArchiveMetadataResult {
  sourceKind: SourceKind;
  unitsFound: number;
  title: string;
}

export interface ArchiveUnitsResult {
  sourceKind: SourceKind;
  total: number;
  alreadyArchived: number;
  archived: number;
  pending: number;
  suspended: boolean;
}

export interface ImportedUnitResult {
  sourceKind: SourceKind;
  unitNumber: number;
  title: string;
  sourceUrl: string;
}

export function isManualInterventionError(
  error: any,
): error is ManualInterventionRequiredError & { unitNumber?: number; sourceKind?: SourceKind } {
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

function isGenericUnitTitle(value: string, bookTitle: string, unitNumber: number): boolean {
  const normalized = normalizeTitle(value);
  if (!normalized) {
    return true;
  }

  return (
    normalized === normalizeTitle(bookTitle) ||
    normalized === `unit ${unitNumber}` ||
    normalized === `ch ${unitNumber}`
  );
}

function selectUnitTitle(indexedTitle: string, scrapedTitle: string, bookTitle: string, unitNumber: number): string {
  const cleanIndexedTitle = indexedTitle?.replace(/\s+/g, ' ').trim() || '';
  const cleanScrapedTitle = scrapedTitle?.replace(/\s+/g, ' ').trim() || '';

  if (cleanIndexedTitle && !isGenericUnitTitle(cleanIndexedTitle, bookTitle, unitNumber)) {
    return cleanIndexedTitle;
  }

  if (cleanScrapedTitle && !isGenericUnitTitle(cleanScrapedTitle, bookTitle, unitNumber)) {
    return cleanScrapedTitle;
  }

  return cleanIndexedTitle || cleanScrapedTitle || `Unit ${unitNumber}`;
}

function sourceLabel(sourceKind: SourceKind): string {
  return sourceKind === 'raw' ? 'raw' : 'translated';
}

function getSourceUrl(book: any, sourceKind: SourceKind): string {
  return String(sourceKind === 'raw' ? book.rawSourceUrl || '' : book.sourceUrl || '').trim();
}

function getUnitList(book: any, sourceKind: SourceKind): UnitIndex[] {
  const source = sourceKind === 'raw' ? book.rawUnitsList || [] : book.translatedUnitsList || [];
  return source.map((unit: any) => ({
    title: unit.title,
    url: unit.url,
    number: Number(unit.unitNumber ?? unit.number),
    unitType: unit.unitType || 'chapter',
  }));
}

function getContentModel(sourceKind: SourceKind): any {
  return sourceKind === 'raw' ? RawBookContent : BookContent;
}

function uniqueValidUnits(translatedUnitsList: UnitIndex[], sourceKind: SourceKind): UnitIndex[] {
  const seenUnitNumbers = new Set<number>();

  return translatedUnitsList.filter((unit: any) => {
    const unitNumber = Number(unit.number);
    if (!Number.isFinite(unitNumber) || seenUnitNumbers.has(unitNumber) || !isHttpUrl(unit.url)) {
      if (unit.url && !isHttpUrl(unit.url)) {
        console.warn(`[Archive] Skipping ${sourceLabel(sourceKind)} unit ${unit.number || '?'} with invalid URL: ${unit.url}`);
      }
      return false;
    }

    seenUnitNumbers.add(unitNumber);
    return true;
  });
}

function makeUnitScrapeError(
  unit: UnitIndex,
  sourceKind: SourceKind,
  error: any,
): Error & { code: string; url: string; unitNumber: number; sourceKind: SourceKind } {
  const label = sourceKind === 'raw' ? 'Raw Unit' : 'Unit';
  const message = `Failed on ${label} ${unit.number} at ${unit.url}: ${error.message || 'Unknown error'}`;
  const wrapped = new Error(message) as Error & {
    code: string;
    url: string;
    unitNumber: number;
    sourceKind: SourceKind;
  };

  wrapped.stack = error.stack;
  wrapped.code = error.code === 'MANUAL_INTERVENTION_REQUIRED' ? 'MANUAL_INTERVENTION_REQUIRED' : 'UNIT_SCRAPE_FAILED';
  wrapped.url = unit.url;
  wrapped.unitNumber = Number(unit.number);
  wrapped.sourceKind = sourceKind;
  return wrapped;
}

async function repairExistingUnitTitles(book: any, sourceKind: SourceKind, uniqueUnits: UnitIndex[]) {
  const ContentModel = getContentModel(sourceKind);
  const existingUnits = await ContentModel.find({
    bookId: book._id,
    unitNumber: { $in: uniqueUnits.map((unit) => unit.number) },
  }).select('unitNumber title');
  const unitIndexByNumber = new Map<number, UnitIndex>(uniqueUnits.map((unit) => [unit.number, unit]));
  const titleRepairOperations = existingUnits.flatMap((unit: any) => {
    const indexedUnit = unitIndexByNumber.get(unit.unitNumber);
    if (!indexedUnit) {
      return [];
    }

    const nextTitle = selectUnitTitle(indexedUnit.title, unit.title, book.title, unit.unitNumber);
    if (nextTitle !== unit.title && isGenericUnitTitle(unit.title, book.title, unit.unitNumber)) {
      return [{
        updateOne: {
          filter: { _id: unit._id },
          update: { $set: { title: nextTitle } },
        },
      }];
    }

    return [];
  });

  if (titleRepairOperations.length > 0) {
    await ContentModel.bulkWrite(titleRepairOperations);
    console.log(`[Archive] Repaired ${titleRepairOperations.length} ${sourceLabel(sourceKind)} unit title(s) from unit index.`);
  }

  return existingUnits;
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class BookArchiveService {
  static async scrapeMetadata(
    book: any,
    sourceKind: SourceKind,
    options: { syncCover?: boolean; requireUnits?: boolean } = {},
  ): Promise<ArchiveMetadataResult> {
    const sourceUrl = getSourceUrl(book, sourceKind);
    if (!sourceUrl) {
      throw new Error(`Book ${sourceKind === 'raw' ? 'rawSourceUrl' : 'sourceUrl'} is empty. Cannot scrape ${sourceLabel(sourceKind)} metadata.`);
    }

    const scraped = await ScraperService.scrapeMetadata(sourceUrl);
    return this.applyMetadata(book, sourceKind, scraped, {
      ...options,
      sourceUrl,
      requireUnits: options.requireUnits ?? sourceKind === 'raw',
    });
  }

  static async importMetadataHtml(
    book: any,
    sourceKind: SourceKind,
    html: string,
    pageUrl: string,
  ): Promise<ArchiveMetadataResult> {
    const parsedPageUrl = new URL(pageUrl).toString();
    const scraped = await ScraperService.scrapeMetadataFromHtml(html, parsedPageUrl);
    return this.applyMetadata(book, sourceKind, scraped, {
      sourceUrl: parsedPageUrl,
      requireUnits: true,
    });
  }

  private static async applyMetadata(
    book: any,
    sourceKind: SourceKind,
    scraped: ScrapedMetadata,
    options: { sourceUrl: string; syncCover?: boolean; requireUnits?: boolean },
  ): Promise<ArchiveMetadataResult> {
    if (options.requireUnits && scraped.units.length === 0) {
      throw new Error(
        `${sourceKind === 'raw' ? 'Raw' : 'Translated'} metadata scraper found 0 units. The site may be blocking Puppeteer, the pasted HTML may not be the catalogue page, or the catalogue pattern is unsupported.`,
      );
    }

    if (sourceKind === 'raw') {
      book.rawUnitsList = scraped.units.map((unit) => ({
        title: unit.title,
        url: unit.url,
        unitNumber: unit.number,
        unitType: 'chapter',
      }));
      book.rawUnitsTotal = scraped.units.length;
      if (!book.rawSourceUrl) {
        book.rawSourceUrl = options.sourceUrl;
      }
      if (!book.rawOriginalLanguage && scraped.originalSource) {
        book.rawOriginalLanguage = scraped.originalSource;
      }
      await book.save();
      return { sourceKind, unitsFound: scraped.units.length, title: book.title };
    }

    if (scraped.title && scraped.title !== 'Unknown Book' && (!book.title || book.title === 'Pending Scrape')) {
      book.title = scraped.title;
    }
    if (scraped.author && scraped.author !== 'Unknown Author' && !book.author) {
      book.author = scraped.author;
    }
    if (scraped.authorPenName && !book.authorPenName) {
      book.authorPenName = scraped.authorPenName;
    }
    if (scraped.authorRealName && !book.authorRealName) {
      book.authorRealName = scraped.authorRealName;
    }
    if (scraped.alternativeNames?.length && (!book.alternativeNames || book.alternativeNames.length === 0)) {
      book.alternativeNames = scraped.alternativeNames;
    }
    if (scraped.genres?.length && (!book.genreIds || book.genreIds.length === 0)) {
      const resolvedGenres = await resolveGenres({ genres: scraped.genres });
      book.genreIds = resolvedGenres.genreIds;
      book.genres = resolvedGenres.genres;
      book.genreKeys = resolvedGenres.genreKeys;
    }
    if (scraped.originalSource && !book.originalSource) {
      book.originalSource = scraped.originalSource;
    }
    if (scraped.publicationStatus && !book.publicationStatus) {
      const resolvedStatus = await resolvePublicationStatus({ publicationStatus: scraped.publicationStatus });
      book.publicationStatusId = resolvedStatus.publicationStatusId;
      book.publicationStatus = resolvedStatus.publicationStatus || scraped.publicationStatus;
      book.publicationStatusKey = resolvedStatus.publicationStatusKey || '';
    }

    const linkedAuthorIds = await resolveAuthorIds({
      author: scraped.author,
      penName: scraped.authorPenName || scraped.author,
      realName: scraped.authorRealName,
      alternativeNames: [],
      officialUrl: options.sourceUrl,
      originalLanguage: book.rawOriginalLanguage,
    });
    if (linkedAuthorIds.length > 0) {
      book.authorIds = linkedAuthorIds;
      book.authorId = linkedAuthorIds[0];
    }

    if (scraped.description && !book.description) {
      book.description = scraped.description;
    }
    if (scraped.coverUrl) {
      if (!book.coverUrl) {
        book.coverUrl = scraped.coverUrl;
      }

      if (options.syncCover) {
        try {
          await syncBookCoverImage(book, scraped.coverUrl);
        } catch (err: any) {
          console.warn(`[Archive] Cover image sync failed for book ${book._id}: ${err.message}`);
        }
      }
    }
    if (!book.sourceUrl) {
      book.sourceUrl = options.sourceUrl;
    }

    book.translatedUnitsList = scraped.units.map((unit) => ({
      title: unit.title,
      url: unit.url,
      unitNumber: unit.number,
      unitType: 'chapter',
    }));
    book.translatedUnitsTotal = scraped.units.length;
    await book.save();

    return { sourceKind, unitsFound: scraped.units.length, title: book.title };
  }

  static async archiveMissingUnits(
    book: any,
    sourceKind: SourceKind,
    options: {
      limit?: number;
      unitNumber?: number;
      concurrency?: number;
      delayMs?: number;
      shouldContinue?: () => boolean;
      onProgress?: (progress: ArchiveProgress) => Promise<void>;
    } = {},
  ): Promise<ArchiveUnitsResult> {
    const uniqueUnits = uniqueValidUnits(getUnitList(book, sourceKind), sourceKind);
    const totalUnits = uniqueUnits.length;
    if (totalUnits === 0) {
      throw new Error(`No ${sourceLabel(sourceKind)} units listed on this book. Run ${sourceLabel(sourceKind)} metadata indexing first.`);
    }

    const existingUnits = await repairExistingUnitTitles(book, sourceKind, uniqueUnits);
    const existingUnitNumbers = new Set(existingUnits.map((unit: any) => unit.unitNumber));
    const pendingUnits = uniqueUnits.filter((unit) => !existingUnitNumbers.has(unit.number));
    const selectedPendingUnits = options.unitNumber
      ? pendingUnits.filter((unit) => unit.number === options.unitNumber)
      : pendingUnits;
    if (options.unitNumber && selectedPendingUnits.length === 0 && !existingUnitNumbers.has(options.unitNumber)) {
      throw new Error(`${sourceKind === 'raw' ? 'Raw unit' : 'Unit'} ${options.unitNumber} is not present in the indexed unit list.`);
    }
    const requestedLimit = Number.isFinite(options.limit) ? Math.max(1, Number(options.limit)) : selectedPendingUnits.length;
    const unitsToArchive = selectedPendingUnits.slice(0, requestedLimit);
    const workerCount = Math.min(Math.max(1, options.concurrency || 1), unitsToArchive.length || 1);
    const ContentModel = getContentModel(sourceKind);
    let completedCount = existingUnitNumbers.size;
    let archivedCount = 0;
    let nextUnitIndex = 0;
    let firstError: Error | null = null;
    let suspended = false;

    await options.onProgress?.({
      current: completedCount,
      total: totalUnits,
      message: `Skipped ${completedCount} already archived ${sourceLabel(sourceKind)} units. Processing ${unitsToArchive.length} missing units now...`,
    });

    async function archiveWorker(workerIndex: number) {
      while (!firstError) {
        if (options.shouldContinue && !options.shouldContinue()) {
          suspended = true;
          return;
        }

        const unit = unitsToArchive[nextUnitIndex++];
        if (!unit) {
          return;
        }

        console.log(
          `[Archive] [${workerIndex + 1}/${workerCount}] Scraping ${sourceLabel(sourceKind)} unit ${unit.number}/${totalUnits}: ${unit.title}`,
        );

        try {
          const scrapedUnit = await ScraperService.scrapeUnit(unit.url);
          const unitTitle = selectUnitTitle(unit.title, scrapedUnit.title, book.title, unit.number);
          const $setOnInsert: Record<string, any> = {
            bookId: book._id,
            unitNumber: unit.number,
            title: unitTitle,
            content: scrapedUnit.content,
            sourceUrl: unit.url,
            scrapedAt: new Date(),
          };
          if (sourceKind === 'raw') {
            $setOnInsert.language = book.rawOriginalLanguage || '';
          }

          const result = await ContentModel.updateOne(
            {
              bookId: book._id,
              unitNumber: unit.number,
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
            total: totalUnits,
            message: `Saved ${sourceLabel(sourceKind)} unit ${unit.number}: ${unitTitle}`,
          });

          await sleep(options.delayMs || 0);
        } catch (err: any) {
          console.error(`[Archive] Error scraping ${sourceLabel(sourceKind)} unit ${unit.number} (${unit.url}):`, err.message);
          firstError = makeUnitScrapeError(unit, sourceKind, err);
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
      total: totalUnits,
      alreadyArchived: existingUnitNumbers.size,
      archived: archivedCount,
      pending: Math.max(0, pendingUnits.length - archivedCount),
      suspended,
    };
  }

  static async importUnitHtml(
    book: any,
    sourceKind: SourceKind,
    unitNumber: number,
    html: string,
    pageUrl: string,
  ): Promise<ImportedUnitResult> {
    const parsedPageUrl = new URL(pageUrl).toString();
    const scrapedUnit = await ScraperService.scrapeUnitFromHtml(html, parsedPageUrl);
    const indexedUnit = getUnitList(book, sourceKind)
      .find((unit) => Number(unit.number) === unitNumber);
    const unitTitle = selectUnitTitle(
      indexedUnit?.title || '',
      scrapedUnit.title,
      book.title,
      unitNumber,
    );
    const ContentModel = getContentModel(sourceKind);
    const $set: Record<string, any> = {
      bookId: book._id,
      unitNumber,
      title: unitTitle,
      content: scrapedUnit.content,
      sourceUrl: parsedPageUrl,
      scrapedAt: new Date(),
    };
    if (sourceKind === 'raw') {
      $set.language = book.rawOriginalLanguage || '';
    }

    await ContentModel.updateOne(
      {
        bookId: book._id,
        unitNumber,
      },
      { $set },
      { upsert: true },
    );

    return {
      sourceKind,
      unitNumber,
      title: unitTitle,
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
        unitNumber: error.unitNumber,
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
      unitNumber: error.unitNumber,
      sourceKind: error.sourceKind,
    };
    await job.save();
  }

  static async createCompletedImportJob(
    book: any,
    userId: string,
    type: 'scrape_metadata' | 'scrape_raw_metadata',
    message: string,
  ) {
    return BackgroundJob.create({
      bookId: book._id,
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

import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { BackgroundJob, JobType } from '../models/BackgroundJob';
import { Book } from '../models/Book';
import { hasCapability, CAPABILITY } from '../services/rbac';
import { BookArchiveService, SourceKind, isManualInterventionError } from '../services/bookArchive';
import { openManualBrowserSession } from '../services/scraper';

const VALID_JOB_TYPES = new Set(['scrape_metadata', 'scrape_chapters', 'scrape_raw_metadata', 'scrape_raw_chapters']);

function jobTypeToSourceKind(type: JobType): SourceKind {
  return type === 'scrape_raw_metadata' || type === 'scrape_raw_chapters' ? 'raw' : 'translated';
}

function sourceKindToMetadataJobType(sourceKind: SourceKind): 'scrape_metadata' | 'scrape_raw_metadata' {
  return sourceKind === 'raw' ? 'scrape_raw_metadata' : 'scrape_metadata';
}

function parseSourceKind(value: unknown): SourceKind {
  return value === 'raw' ? 'raw' : 'translated';
}

function isChapterJob(type: JobType): boolean {
  return type === 'scrape_chapters' || type === 'scrape_raw_chapters';
}

function parseDirectArchiveLimit(value: unknown): number {
  let str = '';
  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'number') {
    str = String(value);
  }
  const parsed = Number.parseInt(str, 10);
  if (!Number.isFinite(parsed)) {
    return 5;
  }

  return Math.min(25, Math.max(1, parsed));
}

function defaultSourceUrl(book: any, sourceKind: SourceKind): string {
  return String(sourceKind === 'raw' ? book.rawSourceUrl || '' : book.sourceUrl || '').trim();
}

export async function listJobsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_LIST))) {
      return reply.status(403).send({ error: 'Admin access is required to view scraper jobs.' });
    }

    const jobs = await BackgroundJob.find({}).sort({ createdAt: -1 });
    return reply.send(jobs);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing background jobs.' });
  }
}

export async function getJobsForBookHandler(request: FastifyRequest, reply: FastifyReply) {
  const { bookId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_LIST))) {
      return reply.status(403).send({ error: 'Admin access is required to view scraper jobs.' });
    }

    const jobs = await BackgroundJob.find({ bookId }).sort({ createdAt: -1 });
    return reply.send(jobs);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching book background jobs.' });
  }
}

export async function retryJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    return reply.status(400).send({ error: 'Invalid job ID.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_RETRY))) {
      return reply.status(403).send({ error: 'Admin access is required to retry scraper jobs.' });
    }

    const job = await BackgroundJob.findOneAndUpdate(
      { _id: jobId, status: { $in: ['failed', 'requires_manual_intervention'] } },
      {
        status: 'pending',
        retryCount: 0,
        error: undefined,
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!job) {
      return reply.status(404).send({ error: 'Job not found, not failed, or unauthorized.' });
    }

    return reply.send({
      success: true,
      message: 'Job status reset to pending. The worker will pick it up shortly.',
      job,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error retrying job.' });
  }
}

export async function openManualInterventionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    return reply.status(400).send({ error: 'Invalid job ID.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_MANUAL_INTERVENTION))) {
      return reply.status(403).send({ error: 'Admin access is required to open a manual scraper browser.' });
    }

    const job = await BackgroundJob.findOne({ _id: jobId });
    if (!job) {
      return reply.status(404).send({ error: 'Job not found or unauthorized.' });
    }

    const book = await Book.findById(job.bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Associated book not found.' });
    }

    const targetUrl =
      job.error?.url ||
      (job.type === 'scrape_raw_metadata' || job.type === 'scrape_raw_chapters' ? book.rawSourceUrl : book.sourceUrl);

    if (!targetUrl) {
      return reply.status(400).send({ error: 'No source URL is available for this job.' });
    }

    await openManualBrowserSession(targetUrl);
    job.progress = {
      current: job.progress?.current || 0,
      total: job.progress?.total || 1,
      message: 'Manual Chromium session opened. Clear the site challenge, then retry this job.',
    };
    await job.save();

    return reply.send({
      success: true,
      message: 'Manual Chromium session opened. Clear the challenge in that browser, then retry the job.',
      url: targetUrl,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error opening manual browser session.' });
  }
}

export async function importRawMetadataHtmlHandler(request: FastifyRequest, reply: FastifyReply) {
  return importMetadataHtmlForSource(request, reply, 'raw');
}

export async function importMetadataHtmlHandler(request: FastifyRequest, reply: FastifyReply) {
  const { sourceKind } = (request.body || {}) as any;
  return importMetadataHtmlForSource(request, reply, parseSourceKind(sourceKind));
}

async function importMetadataHtmlForSource(request: FastifyRequest, reply: FastifyReply, sourceKind: SourceKind) {
  const userId = (request.user as any).id;
  const { bookId } = request.params as any;
  const { html, pageUrl } = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  if (typeof html !== 'string' || html.trim().length < 100) {
    return reply.status(400).send({ error: `Paste the saved ${sourceKind} catalogue HTML before importing.` });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_IMPORT))) {
      return reply.status(403).send({ error: 'Admin access is required to import source HTML.' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const importBaseUrl = String(pageUrl || defaultSourceUrl(book, sourceKind) || '').trim();
    if (!importBaseUrl) {
      return reply.status(400).send({ error: 'Provide the page URL that this HTML was saved from.' });
    }

    let parsedBaseUrl: string;
    try {
      parsedBaseUrl = new URL(importBaseUrl).toString();
    } catch {
      return reply.status(400).send({ error: 'The HTML page URL must be a valid http(s) URL.' });
    }

    const result = await BookArchiveService.importMetadataHtml(book, sourceKind, html, parsedBaseUrl);
    const jobType = sourceKindToMetadataJobType(sourceKind);
    const job = await BookArchiveService.createCompletedImportJob(
      book,
      userId,
      jobType,
      `Imported ${sourceKind} metadata from pasted HTML. Found ${result.chaptersFound} ${sourceKind} chapters.`,
    );

    return reply.send({
      success: true,
      message: `Imported ${result.chaptersFound} ${sourceKind} chapter links from pasted HTML.`,
      sourceKind,
      chaptersFound: result.chaptersFound,
      book,
      job,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error importing source HTML.' });
  }
}

export async function importFailedChapterHtmlHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as any;
  const { html, pageUrl } = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    return reply.status(400).send({ error: 'Invalid job ID.' });
  }

  if (typeof html !== 'string' || html.trim().length < 100) {
    return reply.status(400).send({ error: 'Paste the saved chapter HTML before importing.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_IMPORT))) {
      return reply.status(403).send({ error: 'Admin access is required to import chapter HTML.' });
    }

    const job = await BackgroundJob.findOne({ _id: jobId });
    if (!job) {
      return reply.status(404).send({ error: 'Job not found or unauthorized.' });
    }

    const book = await Book.findById(job.bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Associated book not found.' });
    }

    const sourceKind = job.type === 'scrape_raw_chapters' || job.error?.sourceKind === 'raw' ? 'raw' : 'translated';

    const chapterNumber = Number(job.error?.chapterNumber);
    if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return reply.status(400).send({ error: 'This job does not include a failed chapter number to import.' });
    }

    const importUrl = String(pageUrl || job.error?.url || '').trim();
    if (!importUrl) {
      return reply.status(400).send({ error: 'Provide the chapter URL that this HTML was saved from.' });
    }

    let parsedPageUrl: string;
    try {
      parsedPageUrl = new URL(importUrl).toString();
    } catch {
      return reply.status(400).send({ error: 'The chapter page URL must be a valid http(s) URL.' });
    }

    const imported = await BookArchiveService.importChapterHtml(book, sourceKind, chapterNumber, html, parsedPageUrl);

    job.progress = {
      current: job.progress?.current || 0,
      total: job.progress?.total || 1,
      message: `Imported ${sourceKind === 'raw' ? 'raw ' : ''}chapter ${chapterNumber} from pasted HTML. Retry this job to continue archiving.`,
    };
    await job.save();

    return reply.send({
      success: true,
      message: `Imported ${sourceKind === 'raw' ? 'raw ' : ''}chapter ${chapterNumber} from pasted HTML.`,
      sourceKind,
      chapterNumber: imported.chapterNumber,
      title: imported.title,
      sourceUrl: imported.sourceUrl,
      job,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error importing chapter HTML.' });
  }
}

export async function importChapterHtmlHandler(request: FastifyRequest, reply: FastifyReply) {
  const { bookId } = request.params as any;
  const { html, pageUrl, chapterNumber, sourceKind: sourceKindValue } = request.body as any;
  const sourceKind = parseSourceKind(sourceKindValue);

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedChapterNumber = resolveDirectRunChapterNumber(chapterNumber);
  if (!parsedChapterNumber) {
    return reply.status(400).send({ error: 'Provide the chapter number this HTML belongs to.' });
  }

  if (typeof html !== 'string' || html.trim().length < 100) {
    return reply.status(400).send({ error: 'Paste the saved chapter HTML before importing.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_IMPORT))) {
      return reply.status(403).send({ error: 'Admin access is required to import chapter HTML.' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const indexedChapter = (sourceKind === 'raw' ? book.rawChaptersList : book.translatedChaptersList || []).find(
      (chapter: any) => Number(chapter.number) === parsedChapterNumber,
    );
    const importUrl = String(pageUrl || indexedChapter?.url || '').trim();
    if (!importUrl) {
      return reply.status(400).send({ error: 'Provide the chapter URL that this HTML was saved from.' });
    }

    let parsedPageUrl: string;
    try {
      parsedPageUrl = new URL(importUrl).toString();
    } catch {
      return reply.status(400).send({ error: 'The chapter page URL must be a valid http(s) URL.' });
    }

    const imported = await BookArchiveService.importChapterHtml(
      book,
      sourceKind,
      parsedChapterNumber,
      html,
      parsedPageUrl,
    );

    return reply.send({
      success: true,
      message: `Imported ${sourceKind === 'raw' ? 'raw ' : ''}chapter ${parsedChapterNumber} from pasted HTML.`,
      sourceKind,
      chapterNumber: imported.chapterNumber,
      title: imported.title,
      sourceUrl: imported.sourceUrl,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error importing chapter HTML.' });
  }
}

function resolveDirectRunChapterNumber(value: unknown): number | undefined {
  let str = '';
  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'number') {
    str = String(value);
  }

  const parsed = Number.parseInt(str, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getScrapePrerequisiteError(jobType: JobType, book: any): string | null {
  if ((jobType === 'scrape_metadata' || jobType === 'scrape_chapters') && !book.sourceUrl) {
    return 'Add a translated source URL before running translated scraping.';
  }
  if ((jobType === 'scrape_raw_metadata' || jobType === 'scrape_raw_chapters') && !book.rawSourceUrl) {
    return 'Add a raw source URL before running raw scraping.';
  }
  if (jobType === 'scrape_chapters' && (!book.translatedChaptersList || book.translatedChaptersList.length === 0)) {
    return 'Run translated metadata indexing before archiving translated chapters.';
  }
  if (jobType === 'scrape_raw_chapters' && (!book.rawChaptersList || book.rawChaptersList.length === 0)) {
    return 'Run raw metadata indexing before archiving raw chapters.';
  }
  return null;
}

async function createDirectRunJob(bookId: string, userId: string, jobType: JobType, limit: unknown) {
  const total = isChapterJob(jobType) ? parseDirectArchiveLimit(limit) : 1;
  return BackgroundJob.create({
    bookId,
    userId,
    type: jobType,
    status: 'processing',
    startedAt: new Date(),
    retryCount: 1,
    progress: {
      current: 0,
      total,
      message: `Running ${jobType.replaceAll('_', ' ')} immediately from the admin API...`,
    },
  });
}

type DirectRunSuccess = { success: true; message: string; result: any; book: any; job: any };
type DirectRunFailure = {
  success: false;
  statusCode: number;
  body: {
    error: string;
    requiresManualIntervention: boolean;
    url?: string;
    chapterNumber?: number;
    sourceKind?: SourceKind;
    job: any;
  };
};

async function runDirectArchiveJob(
  job: any,
  book: any,
  jobType: JobType,
  sourceKind: SourceKind,
  safeChapterNumber: number | undefined,
  limit: unknown,
): Promise<DirectRunSuccess | DirectRunFailure> {
  try {
    const chapterJob = isChapterJob(jobType);

    let result: any;
    if (chapterJob) {
      let chapterLimit = parseDirectArchiveLimit(limit);
      let chapterConcurrency = 2;
      if (safeChapterNumber) {
        chapterLimit = 1;
        chapterConcurrency = 1;
      }
      result = await BookArchiveService.archiveMissingChapters(book, sourceKind, {
        limit: chapterLimit,
        chapterNumber: safeChapterNumber,
        concurrency: chapterConcurrency,
        onProgress: async (progress: any) => {
          await BackgroundJob.updateOne({ _id: job._id }, { $set: { progress } });
        },
      });
    } else {
      result = await BookArchiveService.scrapeMetadata(book, sourceKind, {
        syncCover: sourceKind === 'translated',
        requireChapters: true,
      });
    }

    job.status = 'completed';
    job.completedAt = new Date();

    let responseMessage: string;
    if (chapterJob) {
      const archiveResult = result as any;
      job.progress = {
        current: archiveResult.total - archiveResult.pending,
        total: archiveResult.total,
        message: `Direct run archived ${archiveResult.archived} ${sourceKind} chapters. ${archiveResult.pending} remain.`,
      };
      responseMessage = `Archived ${archiveResult.archived} ${sourceKind} chapters now.`;
    } else {
      const metadataResult = result as any;
      job.progress = {
        current: 1,
        total: 1,
        message: `Direct run indexed ${metadataResult.chaptersFound} ${sourceKind} chapters.`,
      };
      responseMessage = `Indexed ${metadataResult.chaptersFound} ${sourceKind} chapters now.`;
    }

    await job.save();

    return { success: true, message: responseMessage, result, book, job };
  } catch (err: any) {
    await BookArchiveService.recordDirectJobFailure(job, err);
    const requiresManualIntervention = isManualInterventionError(err);
    return {
      success: false,
      statusCode: requiresManualIntervention ? 409 : 500,
      body: {
        error: err.message || 'Direct scraper run failed.',
        requiresManualIntervention,
        url: err.url,
        chapterNumber: err.chapterNumber,
        sourceKind: err.sourceKind,
        job,
      },
    };
  }
}

export async function runScrapeNowHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { bookId } = request.params as any;
  const { type, limit, chapterNumber } = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  if (!VALID_JOB_TYPES.has(type)) {
    return reply.status(400).send({ error: 'Invalid scrape job type.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_SCRAPE))) {
      return reply.status(403).send({ error: 'Admin access is required to run scraper tasks.' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const jobType = type as JobType;
    const sourceKind = jobTypeToSourceKind(jobType);
    const prerequisiteError = getScrapePrerequisiteError(jobType, book);
    if (prerequisiteError) {
      return reply.status(400).send({ error: prerequisiteError });
    }

    const safeChapterNumber = resolveDirectRunChapterNumber(chapterNumber);
    const job = await createDirectRunJob(bookId, userId, jobType, limit);
    const outcome = await runDirectArchiveJob(job, book, jobType, sourceKind, safeChapterNumber, limit);

    if (!outcome.success) {
      return reply.status(outcome.statusCode).send(outcome.body);
    }

    return reply.send(outcome);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error running scraper task.' });
  }
}

export async function triggerScrapeHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { bookId } = request.params as any;
  const { type } = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  if (!VALID_JOB_TYPES.has(type)) {
    return reply.status(400).send({ error: 'Invalid scrape job type.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_SCRAPE))) {
      return reply.status(403).send({ error: 'Admin access is required to trigger scraper jobs.' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }
    if ((type === 'scrape_metadata' || type === 'scrape_chapters') && !book.sourceUrl) {
      return reply.status(400).send({ error: 'Add a translated source URL before triggering translated scraping.' });
    }
    if ((type === 'scrape_raw_metadata' || type === 'scrape_raw_chapters') && !book.rawSourceUrl) {
      return reply.status(400).send({ error: 'Add a raw source URL before triggering raw scraping.' });
    }
    if (type === 'scrape_chapters' && (!book.translatedChaptersList || book.translatedChaptersList.length === 0)) {
      return reply
        .status(400)
        .send({ error: 'Run translated metadata scraping before archiving translated chapters.' });
    }
    if (type === 'scrape_raw_chapters' && (!book.rawChaptersList || book.rawChaptersList.length === 0)) {
      return reply.status(400).send({ error: 'Run raw metadata scraping before archiving raw chapters.' });
    }

    // Check if there is already an active job (pending or processing) of this type
    const activeJob = await BackgroundJob.findOne({
      bookId,
      type,
      status: { $in: ['pending', 'processing'] },
    });

    if (activeJob) {
      return reply.status(400).send({ error: `An active ${type} job is already running for this book.` });
    }

    // Create new pending job
    const job = await BackgroundJob.create({
      bookId,
      userId,
      type,
      status: 'pending',
    });

    return reply.status(201).send({ success: true, message: 'Job successfully queued.', job });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error triggering job.' });
  }
}

import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { BackgroundJob, JobType } from '../models/BackgroundJob.js';
import { Book } from '../models/Novel.js';
import { hasCapability, CAPABILITY } from '../services/rbac.js';
import { BookArchiveService, SourceKind, isManualInterventionError } from '../services/novelArchive.js';
import { openManualBrowserSession } from '../services/scraper.js';

const VALID_JOB_TYPES = new Set(['scrape_metadata', 'scrape_units', 'scrape_raw_metadata', 'scrape_raw_units']);

function jobTypeToSourceKind(type: JobType): SourceKind {
  return type === 'scrape_raw_metadata' || type === 'scrape_raw_units' ? 'raw' : 'translated';
}

function sourceKindToMetadataJobType(sourceKind: SourceKind): 'scrape_metadata' | 'scrape_raw_metadata' {
  return sourceKind === 'raw' ? 'scrape_raw_metadata' : 'scrape_metadata';
}

function parseSourceKind(value: unknown): SourceKind {
  return value === 'raw' ? 'raw' : 'translated';
}

function isUnitJob(type: JobType): boolean {
  return type === 'scrape_units' || type === 'scrape_raw_units';
}

function parseDirectArchiveLimit(value: unknown): number {
  const parsed = Number.parseInt(String(value || ''), 10);
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
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!job) {
      return reply.status(404).send({ error: 'Job not found, not failed, or unauthorized.' });
    }

    return reply.send({ success: true, message: 'Job status reset to pending. The worker will pick it up shortly.', job });
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
      (job.type === 'scrape_raw_metadata' || job.type === 'scrape_raw_units'
        ? book.rawSourceUrl
        : book.sourceUrl);

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
      `Imported ${sourceKind} metadata from pasted HTML. Found ${result.unitsFound} ${sourceKind} units.`,
    );

    return reply.send({
      success: true,
      message: `Imported ${result.unitsFound} ${sourceKind} unit links from pasted HTML.`,
      sourceKind,
      unitsFound: result.unitsFound,
      book,
      job,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error importing source HTML.' });
  }
}

export async function importFailedUnitHtmlHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as any;
  const { html, pageUrl } = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    return reply.status(400).send({ error: 'Invalid job ID.' });
  }

  if (typeof html !== 'string' || html.trim().length < 100) {
    return reply.status(400).send({ error: 'Paste the saved unit HTML before importing.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_IMPORT))) {
      return reply.status(403).send({ error: 'Admin access is required to import unit HTML.' });
    }

    const job = await BackgroundJob.findOne({ _id: jobId });
    if (!job) {
      return reply.status(404).send({ error: 'Job not found or unauthorized.' });
    }

    const book = await Book.findById(job.bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Associated book not found.' });
    }

    const sourceKind = job.type === 'scrape_raw_units' || job.error?.sourceKind === 'raw' ? 'raw' : 'translated';

    const unitNumber = Number(job.error?.unitNumber);
    if (!Number.isFinite(unitNumber) || unitNumber <= 0) {
      return reply.status(400).send({ error: 'This job does not include a failed unit number to import.' });
    }

    const importUrl = String(pageUrl || job.error?.url || '').trim();
    if (!importUrl) {
      return reply.status(400).send({ error: 'Provide the unit URL that this HTML was saved from.' });
    }

    let parsedPageUrl: string;
    try {
      parsedPageUrl = new URL(importUrl).toString();
    } catch {
      return reply.status(400).send({ error: 'The unit page URL must be a valid http(s) URL.' });
    }

    const imported = await BookArchiveService.importUnitHtml(book, sourceKind, unitNumber, html, parsedPageUrl);

    job.progress = {
      current: job.progress?.current || 0,
      total: job.progress?.total || 1,
      message: `Imported ${sourceKind === 'raw' ? 'raw ' : ''}unit ${unitNumber} from pasted HTML. Retry this job to continue archiving.`,
    };
    await job.save();

    return reply.send({
      success: true,
      message: `Imported ${sourceKind === 'raw' ? 'raw ' : ''}unit ${unitNumber} from pasted HTML.`,
      sourceKind,
      unitNumber: imported.unitNumber,
      title: imported.title,
      sourceUrl: imported.sourceUrl,
      job,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error importing unit HTML.' });
  }
}

export async function importUnitHtmlHandler(request: FastifyRequest, reply: FastifyReply) {
  const { bookId } = request.params as any;
  const { html, pageUrl, unitNumber, sourceKind: sourceKindValue } = request.body as any;
  const sourceKind = parseSourceKind(sourceKindValue);

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return reply.status(400).send({ error: 'Invalid book ID.' });
  }

  const parsedUnitNumber = Number.parseInt(String(unitNumber || ''), 10);
  if (!Number.isFinite(parsedUnitNumber) || parsedUnitNumber <= 0) {
    return reply.status(400).send({ error: 'Provide the unit number this HTML belongs to.' });
  }

  if (typeof html !== 'string' || html.trim().length < 100) {
    return reply.status(400).send({ error: 'Paste the saved unit HTML before importing.' });
  }

  try {
    if (!(await hasCapability(request, CAPABILITY.JOBS_IMPORT))) {
      return reply.status(403).send({ error: 'Admin access is required to import unit HTML.' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return reply.status(404).send({ error: 'Book not found.' });
    }

    const indexedUnit = (sourceKind === 'raw' ? book.rawUnitsList : book.translatedUnitsList || [])
      .find((unit: any) => Number(unit.number) === parsedUnitNumber);
    const importUrl = String(pageUrl || indexedUnit?.url || '').trim();
    if (!importUrl) {
      return reply.status(400).send({ error: 'Provide the unit URL that this HTML was saved from.' });
    }

    let parsedPageUrl: string;
    try {
      parsedPageUrl = new URL(importUrl).toString();
    } catch {
      return reply.status(400).send({ error: 'The unit page URL must be a valid http(s) URL.' });
    }

    const imported = await BookArchiveService.importUnitHtml(book, sourceKind, parsedUnitNumber, html, parsedPageUrl);

    return reply.send({
      success: true,
      message: `Imported ${sourceKind === 'raw' ? 'raw ' : ''}unit ${parsedUnitNumber} from pasted HTML.`,
      sourceKind,
      unitNumber: imported.unitNumber,
      title: imported.title,
      sourceUrl: imported.sourceUrl,
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'Server error importing unit HTML.' });
  }
}

export async function runScrapeNowHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { bookId } = request.params as any;
  const { type, limit, unitNumber } = request.body as any;

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
    const requestedUnitNumber = Number.parseInt(String(unitNumber || ''), 10);
    const safeUnitNumber = Number.isFinite(requestedUnitNumber) && requestedUnitNumber > 0
      ? requestedUnitNumber
      : undefined;
    if ((jobType === 'scrape_metadata' || jobType === 'scrape_units') && !book.sourceUrl) {
      return reply.status(400).send({ error: 'Add a translated source URL before running translated scraping.' });
    }
    if ((jobType === 'scrape_raw_metadata' || jobType === 'scrape_raw_units') && !book.rawSourceUrl) {
      return reply.status(400).send({ error: 'Add a raw source URL before running raw scraping.' });
    }
    if (jobType === 'scrape_units' && (!book.translatedUnitsList || book.translatedUnitsList.length === 0)) {
      return reply.status(400).send({ error: 'Run translated metadata indexing before archiving translated units.' });
    }
    if (jobType === 'scrape_raw_units' && (!book.rawUnitsList || book.rawUnitsList.length === 0)) {
      return reply.status(400).send({ error: 'Run raw metadata indexing before archiving raw units.' });
    }

    const job = await BackgroundJob.create({
      bookId,
      userId,
      type: jobType,
      status: 'processing',
      startedAt: new Date(),
      retryCount: 1,
      progress: {
        current: 0,
        total: isUnitJob(jobType) ? parseDirectArchiveLimit(limit) : 1,
        message: `Running ${jobType.replace(/_/g, ' ')} immediately from the admin API...`,
      },
    });

    try {
      const result = isUnitJob(jobType)
        ? await BookArchiveService.archiveMissingUnits(book, sourceKind, {
            limit: safeUnitNumber ? 1 : parseDirectArchiveLimit(limit),
            unitNumber: safeUnitNumber,
            concurrency: safeUnitNumber ? 1 : 2,
            onProgress: async (progress) => {
              await BackgroundJob.updateOne({ _id: job._id }, { $set: { progress } });
            },
          })
        : await BookArchiveService.scrapeMetadata(book, sourceKind, {
            syncCover: sourceKind === 'translated',
            requireUnits: true,
          });

      job.status = 'completed';
      job.completedAt = new Date();
      job.progress = isUnitJob(jobType)
        ? {
            current: (result as any).total - (result as any).pending,
            total: (result as any).total,
            message: `Direct run archived ${(result as any).archived} ${sourceKind} units. ${(result as any).pending} remain.`,
          }
        : {
            current: 1,
            total: 1,
            message: `Direct run indexed ${(result as any).unitsFound} ${sourceKind} units.`,
          };
      await job.save();

      return reply.send({
        success: true,
        message: isUnitJob(jobType)
          ? `Archived ${(result as any).archived} ${sourceKind} units now.`
          : `Indexed ${(result as any).unitsFound} ${sourceKind} units now.`,
        result,
        book,
        job,
      });
    } catch (err: any) {
      await BookArchiveService.recordDirectJobFailure(job, err);
      const statusCode = isManualInterventionError(err) ? 409 : 500;
      return reply.status(statusCode).send({
        error: err.message || 'Direct scraper run failed.',
        requiresManualIntervention: isManualInterventionError(err),
        url: err.url,
        unitNumber: err.unitNumber,
        sourceKind: err.sourceKind,
        job,
      });
    }
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
    if ((type === 'scrape_metadata' || type === 'scrape_units') && !book.sourceUrl) {
      return reply.status(400).send({ error: 'Add a translated source URL before triggering translated scraping.' });
    }
    if ((type === 'scrape_raw_metadata' || type === 'scrape_raw_units') && !book.rawSourceUrl) {
      return reply.status(400).send({ error: 'Add a raw source URL before triggering raw scraping.' });
    }
    if (type === 'scrape_units' && (!book.translatedUnitsList || book.translatedUnitsList.length === 0)) {
      return reply.status(400).send({ error: 'Run translated metadata scraping before archiving translated units.' });
    }
    if (type === 'scrape_raw_units' && (!book.rawUnitsList || book.rawUnitsList.length === 0)) {
      return reply.status(400).send({ error: 'Run raw metadata scraping before archiving raw units.' });
    }

    // Check if there is already an active job (pending or processing) of this type
    const activeJob = await BackgroundJob.findOne({
      bookId,
      type,
      status: { $in: ['pending', 'processing'] }
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

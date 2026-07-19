import { BackgroundJob, IBackgroundJob } from '../models/BackgroundJob';
import { Book } from '../models/Novel';
import { ManualInterventionRequiredError } from '../services/scraper';
import { EmailService } from '../services/email';
import { BookArchiveService } from '../services/novelArchive';

// Configuration
const POLL_INTERVAL_MS = 5000;
const DELAY_BETWEEN_CHAPTERS_MS = getNumberFromEnv('SCRAPER_CHAPTER_DELAY_MS', 0, 0, 10000);
const CHAPTER_SCRAPE_CONCURRENCY = getNumberFromEnv('SCRAPER_CHAPTER_CONCURRENCY', 8, 1, 10);
const MAX_RETRIES = 3;
const RECOVER_PROCESSING_JOBS_ON_START = process.env.RECOVER_PROCESSING_JOBS_ON_START !== 'false';

let isRunning = false;
let workerTimeout: NodeJS.Timeout | null = null;

function getNumberFromEnv(name: string, defaultValue: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, parsed));
}

function isManualInterventionError(
  error: any,
): error is ManualInterventionRequiredError & { chapterNumber?: number; sourceKind?: 'translated' | 'raw' } {
  return error?.code === 'MANUAL_INTERVENTION_REQUIRED';
}

/**
 * Starts the background worker loop
 */
export function startWorker() {
  if (isRunning) return;
  isRunning = true;
  console.log('Background Job Worker started.');
  void startWorkerLoop();
}

/**
 * Stops the background worker gracefully
 */
export function stopWorker() {
  isRunning = false;
  if (workerTimeout) {
    clearTimeout(workerTimeout);
    workerTimeout = null;
  }
  console.log('Background Job Worker stopped.');
}

async function startWorkerLoop() {
  try {
    if (RECOVER_PROCESSING_JOBS_ON_START) {
      await recoverInterruptedJobs();
    }
  } catch (err) {
    console.error('[Worker] Failed to recover interrupted jobs before startup:', err);
  }

  if (isRunning) {
    await workerLoop();
  }
}

async function recoverInterruptedJobs() {
  const result = await BackgroundJob.updateMany(
    { status: 'processing' },
    {
      $set: {
        status: 'pending',
        'progress.message': 'Backend restarted. Job re-queued and will resume shortly...',
      },
      $unset: {
        startedAt: '',
        failedAt: '',
        error: '',
      },
    },
  );

  if (result.modifiedCount > 0) {
    console.log(`[Worker] Re-queued ${result.modifiedCount} interrupted job(s) from previous backend run.`);
  }
}

async function workerLoop() {
  if (!isRunning) return;

  try {
    await processNextJob();
  } catch (err) {
    console.error('Error in worker loop execution:', err);
  }

  if (isRunning) {
    workerTimeout = setTimeout(workerLoop, POLL_INTERVAL_MS);
  }
}

/**
 * Claims and processes a single pending job from the database
 */
async function processNextJob() {
  // Atomically claim a pending job
  const job = await BackgroundJob.findOneAndUpdate(
    { status: 'pending' },
    {
      status: 'processing',
      startedAt: new Date(),
      $inc: { retryCount: 1 },
    },
    { new: true, sort: { createdAt: 1 } },
  );

  if (!job) {
    // No jobs to process
    return;
  }

  console.log(`[Worker] Claimed job ${job._id} of type ${job.type} for book ${job.bookId}`);

  const book = await Book.findById(job.bookId);
  if (!book) {
    // Book not found, job cannot be processed
    job.status = 'failed';
    job.failedAt = new Date();
    job.error = { message: 'Associated book not found in database.' };
    await job.save();
    return;
  }

  try {
    if (job.type === 'scrape_metadata') {
      await handleScrapeMetadata(job, book);
    } else if (job.type === 'scrape_chapters') {
      await handleScrapeChapters(job, book);
    } else if (job.type === 'scrape_raw_metadata') {
      await handleScrapeRawMetadata(job, book);
    } else if (job.type === 'scrape_raw_chapters') {
      await handleScrapeRawChapters(job, book);
    }
  } catch (error: any) {
    console.error(`[Worker] Job ${job._id} failed:`, error.message);

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
        message: 'Manual browser clearance is required before this job can continue.',
      };
      await job.save();
      return;
    }

    // Check if we exceed max retries
    if (job.retryCount >= MAX_RETRIES) {
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

      // Trigger Email Notification Alert
      await EmailService.sendJobFailureAlert(
        job._id.toString(),
        book.title,
        job.type,
        error.message || 'Unknown error.',
        error.stack,
      );
    } else {
      // Put job back to pending for retry
      job.status = 'pending';
      job.progress.message = `Failed, retrying (Attempt ${job.retryCount}/${MAX_RETRIES})...`;
      await job.save();
    }
  }
}

/**
 * Handles scraping metadata of a book and creating chapters index list
 */
async function handleScrapeMetadata(job: IBackgroundJob, book: any) {
  job.progress = { current: 0, total: 1, message: 'Scraping website metadata and chapters list...' };
  await job.save();

  const result = await BookArchiveService.scrapeMetadata(book, 'translated', { syncCover: true });

  // Mark metadata job completed
  job.status = 'completed';
  job.completedAt = new Date();
  job.progress = {
    current: 1,
    total: 1,
    message: `Successfully fetched metadata. Found ${result.chaptersFound} chapters.`,
  };
  await job.save();

  // Queue chapters download job automatically
  if (result.chaptersFound > 0) {
    const chaptersJobExists = await BackgroundJob.findOne({
      bookId: book._id,
      type: 'scrape_chapters',
      status: { $in: ['pending', 'processing'] },
    });

    if (!chaptersJobExists) {
      await BackgroundJob.create({
        bookId: book._id,
        userId: job.userId,
        type: 'scrape_chapters',
        status: 'pending',
      });
      console.log(`[Worker] Automatically queued scrape_chapters job for book ${book.title}`);
    }
  }
}

async function handleScrapeRawMetadata(job: IBackgroundJob, book: any) {
  job.progress = { current: 0, total: 1, message: 'Scraping raw source metadata and chapter list...' };
  await job.save();

  const result = await BookArchiveService.scrapeMetadata(book, 'raw', { requireChapters: true });

  job.status = 'completed';
  job.completedAt = new Date();
  job.progress = {
    current: 1,
    total: 1,
    message: `Successfully fetched raw metadata. Found ${result.chaptersFound} raw chapters.`,
  };
  await job.save();

  console.log(
    `[Worker] Raw metadata ready for ${book.title}. Raw chapter archiving must be triggered explicitly by an admin.`,
  );
}

/**
 * Handles downloading and storing actual chapter contents with bounded parallelism
 */
async function handleScrapeChapters(job: IBackgroundJob, book: any) {
  job.progress = {
    current: 0,
    total: book.translatedChaptersList?.length || 0,
    message: `Processing translated chapters with ${CHAPTER_SCRAPE_CONCURRENCY} parallel browser pages...`,
  };
  await job.save();

  const result = await BookArchiveService.archiveMissingChapters(book, 'translated', {
    concurrency: CHAPTER_SCRAPE_CONCURRENCY,
    delayMs: DELAY_BETWEEN_CHAPTERS_MS,
    shouldContinue: () => isRunning,
    onProgress: async (progress) => {
      await BackgroundJob.updateOne({ _id: job._id }, { $set: { progress } });
    },
  });

  if (result.suspended) {
    // Release job back to pending so another execution can pick it up
    job.status = 'pending';
    job.progress = {
      current: result.alreadyArchived + result.archived,
      total: result.total,
      message: 'Worker stopped. Task suspended.',
    };
    await job.save();
    return;
  }

  // Mark job completed
  job.status = 'completed';
  job.completedAt = new Date();
  job.progress = {
    current: result.total - result.pending,
    total: result.total,
    message: `Successfully archived ${result.archived} translated chapters. ${result.pending} remain.`,
  };
  await job.save();
}

async function handleScrapeRawChapters(job: IBackgroundJob, book: any) {
  job.progress = {
    current: 0,
    total: book.rawChaptersList?.length || 0,
    message: `Processing raw chapters with ${CHAPTER_SCRAPE_CONCURRENCY} parallel browser pages...`,
  };
  await job.save();

  const result = await BookArchiveService.archiveMissingChapters(book, 'raw', {
    concurrency: CHAPTER_SCRAPE_CONCURRENCY,
    delayMs: DELAY_BETWEEN_CHAPTERS_MS,
    shouldContinue: () => isRunning,
    onProgress: async (progress) => {
      await BackgroundJob.updateOne({ _id: job._id }, { $set: { progress } });
    },
  });

  if (result.suspended) {
    job.status = 'pending';
    job.progress = {
      current: result.alreadyArchived + result.archived,
      total: result.total,
      message: 'Worker stopped. Raw task suspended.',
    };
    await job.save();
    return;
  }

  job.status = 'completed';
  job.completedAt = new Date();
  job.progress = {
    current: result.total - result.pending,
    total: result.total,
    message: `Successfully archived ${result.archived} raw chapters. ${result.pending} remain.`,
  };
  await job.save();
}

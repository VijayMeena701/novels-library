import { BackgroundJob, IBackgroundJob } from "../models/BackgroundJob.js";
import { Novel } from "../models/Novel.js";
import { ChapterContent } from "../models/ChapterContent.js";
import { RawChapterContent } from "../models/RawChapterContent.js";
import { ScraperService } from "../services/scraper.js";
import { EmailService } from "../services/email.js";
import { syncNovelCoverImage } from "../services/coverImage.js";
import { resolveAuthorIds } from "../services/authors.js";
import { resolveGenres, resolvePublicationStatus } from "../services/taxonomy.js";

// Configuration
const POLL_INTERVAL_MS = 5000;
const DELAY_BETWEEN_CHAPTERS_MS = getNumberFromEnv("SCRAPER_CHAPTER_DELAY_MS", 0, 0, 10000);
const CHAPTER_SCRAPE_CONCURRENCY = getNumberFromEnv("SCRAPER_CHAPTER_CONCURRENCY", 8, 1, 10);
const MAX_RETRIES = 3;
const RECOVER_PROCESSING_JOBS_ON_START = process.env.RECOVER_PROCESSING_JOBS_ON_START !== "false";

let isRunning = false;
let workerTimeout: NodeJS.Timeout | null = null;

/**
 * Utility to sleep for a given number of milliseconds
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getNumberFromEnv(name: string, defaultValue: number, min: number, max: number): number {
	const parsed = Number.parseInt(process.env[name] || "", 10);
	if (!Number.isFinite(parsed)) {
		return defaultValue;
	}

	return Math.min(max, Math.max(min, parsed));
}

function isHttpUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

function normalizeTitle(value: string): string {
	return value.replace(/\s+/g, " ").trim().toLowerCase();
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
	const cleanIndexedTitle = indexedTitle?.replace(/\s+/g, " ").trim() || "";
	const cleanScrapedTitle = scrapedTitle?.replace(/\s+/g, " ").trim() || "";

	if (cleanIndexedTitle && !isGenericChapterTitle(cleanIndexedTitle, novelTitle, chapterNumber)) {
		return cleanIndexedTitle;
	}

	if (cleanScrapedTitle && !isGenericChapterTitle(cleanScrapedTitle, novelTitle, chapterNumber)) {
		return cleanScrapedTitle;
	}

	return cleanIndexedTitle || cleanScrapedTitle || `Chapter ${chapterNumber}`;
}

/**
 * Starts the background worker loop
 */
export function startWorker() {
	if (isRunning) return;
	isRunning = true;
	console.log("Background Job Worker started.");
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
	console.log("Background Job Worker stopped.");
}

async function startWorkerLoop() {
	try {
		if (RECOVER_PROCESSING_JOBS_ON_START) {
			await recoverInterruptedJobs();
		}
	} catch (err) {
		console.error("[Worker] Failed to recover interrupted jobs before startup:", err);
	}

	if (isRunning) {
		await workerLoop();
	}
}

async function recoverInterruptedJobs() {
	const result = await BackgroundJob.updateMany(
		{ status: "processing" },
		{
			$set: {
				status: "pending",
				"progress.message": "Backend restarted. Job re-queued and will resume shortly...",
			},
			$unset: {
				startedAt: "",
				failedAt: "",
				error: "",
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
		console.error("Error in worker loop execution:", err);
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
		{ status: "pending" },
		{
			status: "processing",
			startedAt: new Date(),
			$inc: { retryCount: 1 },
		},
		{ new: true, sort: { createdAt: 1 } },
	);

	if (!job) {
		// No jobs to process
		return;
	}

	console.log(`[Worker] Claimed job ${job._id} of type ${job.type} for novel ${job.novelId}`);

	const novel = await Novel.findById(job.novelId);
	if (!novel) {
		// Novel not found, job cannot be processed
		job.status = "failed";
		job.failedAt = new Date();
		job.error = { message: "Associated novel not found in database." };
		await job.save();
		return;
	}

	try {
		if (job.type === "scrape_metadata") {
			await handleScrapeMetadata(job, novel);
		} else if (job.type === "scrape_chapters") {
			await handleScrapeChapters(job, novel);
		} else if (job.type === "scrape_raw_metadata") {
			await handleScrapeRawMetadata(job, novel);
		} else if (job.type === "scrape_raw_chapters") {
			await handleScrapeRawChapters(job, novel);
		}
	} catch (error: any) {
		console.error(`[Worker] Job ${job._id} failed:`, error.message);

		// Check if we exceed max retries
		if (job.retryCount >= MAX_RETRIES) {
			job.status = "failed";
			job.failedAt = new Date();
			job.error = {
				message: error.message || "Unknown error occurred.",
				stack: error.stack,
			};
			await job.save();

			// Trigger Email Notification Alert
			await EmailService.sendJobFailureAlert(
				job._id.toString(),
				novel.title,
				job.type,
				error.message || "Unknown error.",
				error.stack,
			);
		} else {
			// Put job back to pending for retry
			job.status = "pending";
			job.progress.message = `Failed, retrying (Attempt ${job.retryCount}/${MAX_RETRIES})...`;
			await job.save();
		}
	}
}

/**
 * Handles scraping metadata of a novel and creating chapters index list
 */
async function handleScrapeMetadata(job: IBackgroundJob, novel: any) {
	job.progress = { current: 0, total: 1, message: "Scraping website metadata and chapters list..." };
	await job.save();

	if (!novel.sourceUrl) {
		throw new Error("Novel sourceUrl is empty. Cannot scrape metadata.");
	}

	const scraped = await ScraperService.scrapeMetadata(novel.sourceUrl);

	// Update novel with details
	if (scraped.title && scraped.title !== "Unknown Novel" && (!novel.title || novel.title === "Pending Scrape")) {
		novel.title = scraped.title;
	}
	if (scraped.author && scraped.author !== "Unknown Author" && !novel.author) {
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
		novel.publicationStatusKey = resolvedStatus.publicationStatusKey || "";
	}
	const linkedAuthorIds = await resolveAuthorIds({
		author: scraped.author,
		penName: scraped.authorPenName || scraped.author,
		realName: scraped.authorRealName,
		alternativeNames: [],
		officialUrl: novel.sourceUrl,
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

		try {
			await syncNovelCoverImage(novel, scraped.coverUrl);
		} catch (err: any) {
			console.warn(`[Worker] Cover image sync failed for novel ${novel._id}: ${err.message}`);
		}
	}

	// Update chapters index list
	novel.chaptersList = scraped.chapters;
	novel.chaptersTotal = scraped.chapters.length;
	await novel.save();

	// Mark metadata job completed
	job.status = "completed";
	job.completedAt = new Date();
	job.progress = {
		current: 1,
		total: 1,
		message: `Successfully fetched metadata. Found ${scraped.chapters.length} chapters.`,
	};
	await job.save();

	// Queue chapters download job automatically
	if (scraped.chapters.length > 0) {
		const chaptersJobExists = await BackgroundJob.findOne({
			novelId: novel._id,
			type: "scrape_chapters",
			status: { $in: ["pending", "processing"] },
		});

		if (!chaptersJobExists) {
			await BackgroundJob.create({
				novelId: novel._id,
				userId: job.userId,
				type: "scrape_chapters",
				status: "pending",
			});
			console.log(`[Worker] Automatically queued scrape_chapters job for novel ${novel.title}`);
		}
	}
}

async function handleScrapeRawMetadata(job: IBackgroundJob, novel: any) {
	job.progress = { current: 0, total: 1, message: "Scraping raw source metadata and chapter list..." };
	await job.save();

	if (!novel.rawSourceUrl) {
		throw new Error("Novel rawSourceUrl is empty. Cannot scrape raw metadata.");
	}

	const scraped = await ScraperService.scrapeMetadata(novel.rawSourceUrl);
	novel.rawChaptersList = scraped.chapters;
	novel.rawChaptersTotal = scraped.chapters.length;
	if (!novel.rawOriginalLanguage && scraped.originalSource) {
		novel.rawOriginalLanguage = scraped.originalSource;
	}
	await novel.save();

	job.status = "completed";
	job.completedAt = new Date();
	job.progress = {
		current: 1,
		total: 1,
		message: `Successfully fetched raw metadata. Found ${scraped.chapters.length} raw chapters.`,
	};
	await job.save();

	console.log(`[Worker] Raw metadata ready for ${novel.title}. Raw chapter archiving must be triggered explicitly by an admin.`);
}

/**
 * Handles downloading and storing actual chapter contents with bounded parallelism
 */
async function handleScrapeChapters(job: IBackgroundJob, novel: any) {
	const chaptersList = novel.chaptersList || [];
	const seenChapterNumbers = new Set<number>();
	const uniqueChapters = chaptersList.filter((chapter: any) => {
		const chapterNumber = Number(chapter.number);
		if (!Number.isFinite(chapterNumber) || seenChapterNumbers.has(chapterNumber) || !isHttpUrl(chapter.url)) {
			if (chapter.url && !isHttpUrl(chapter.url)) {
				console.warn(`[Worker] Skipping chapter ${chapter.number || "?"} with invalid URL: ${chapter.url}`);
			}
			return false;
		}

		seenChapterNumbers.add(chapterNumber);
		return true;
	});
	const totalChapters = uniqueChapters.length;

	if (totalChapters === 0) {
		// If chapters list is empty, we must scrape metadata first
		throw new Error("No chapters listed on this novel. Run metadata scraper first.");
	}

	job.progress = {
		current: 0,
		total: totalChapters,
		message: `Processing ${totalChapters} chapters with ${CHAPTER_SCRAPE_CONCURRENCY} parallel browser pages...`,
	};
	await job.save();

	const existingChapters = await ChapterContent.find({
		novelId: novel._id,
		chapterNumber: { $in: uniqueChapters.map((chapter: any) => chapter.number) },
	}).select("chapterNumber title");
	const existingChapterNumbers = new Set(existingChapters.map((chapter) => chapter.chapterNumber));
	const chapterIndexByNumber = new Map<number, any>(uniqueChapters.map((chapter: any) => [chapter.number, chapter]));
	const titleRepairOperations = existingChapters.flatMap((chapter) => {
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
		await ChapterContent.bulkWrite(titleRepairOperations);
		console.log(`[Worker] Repaired ${titleRepairOperations.length} archived chapter title(s) from chapter index.`);
	}

	const pendingChapters = uniqueChapters.filter((chapter: any) => !existingChapterNumbers.has(chapter.number));
	const workerCount = Math.min(CHAPTER_SCRAPE_CONCURRENCY, pendingChapters.length);
	let completedCount = existingChapterNumbers.size;
	let nextChapterIndex = 0;
	let firstError: Error | null = null;

	const updateProgress = async (message: string) => {
		await BackgroundJob.updateOne(
			{ _id: job._id },
			{
				$set: {
					progress: {
						current: completedCount,
						total: totalChapters,
						message,
					},
				},
			},
		);
	};

	if (completedCount > 0) {
		await updateProgress(
			`Skipped ${completedCount} chapters already archived. Processing ${pendingChapters.length} remaining chapters...`,
		);
	}

	if (pendingChapters.length > 0) {
		console.log(`[Worker] Scraping ${pendingChapters.length} chapters with concurrency ${workerCount}.`);
	}

	async function scrapeWorker(workerIndex: number) {
		while (isRunning && !firstError) {
			const chapter = pendingChapters[nextChapterIndex++];
			if (!chapter) {
				return;
			}

			console.log(
				`[Worker] [${workerIndex + 1}/${workerCount}] Scraping chapter ${chapter.number}/${totalChapters}: ${chapter.title}`,
			);
			try {
				const scrapedChapter = await ScraperService.scrapeChapter(chapter.url);
				const chapterTitle = selectChapterTitle(chapter.title, scrapedChapter.title, novel.title, chapter.number);

				await ChapterContent.updateOne(
					{
						novelId: novel._id,
						chapterNumber: chapter.number,
					},
					{
						$setOnInsert: {
							novelId: novel._id,
							chapterNumber: chapter.number,
							title: chapterTitle,
							content: scrapedChapter.content,
							sourceUrl: chapter.url,
							scrapedAt: new Date(),
						},
					},
					{ upsert: true },
				);

				completedCount++;
				await updateProgress(`Saved chapter ${chapter.number}: ${chapterTitle}`);

				if (DELAY_BETWEEN_CHAPTERS_MS > 0) {
					await sleep(DELAY_BETWEEN_CHAPTERS_MS);
				}
			} catch (chErr: any) {
				console.error(`[Worker] Error scraping chapter ${chapter.number} (${chapter.url}):`, chErr.message);
				firstError = new Error(`Failed on Chapter ${chapter.number}: ${chErr.message}`);
				return;
			}
		}
	}

	await Promise.all(Array.from({ length: workerCount }, (_, index) => scrapeWorker(index)));

	if (!isRunning) {
		// Release job back to pending so another execution can pick it up
		job.status = "pending";
		job.progress = {
			current: completedCount,
			total: totalChapters,
			message: "Worker stopped. Task suspended.",
		};
		await job.save();
		return;
	}

	if (firstError) {
		throw firstError;
	}

	// Mark job completed
	job.status = "completed";
	job.completedAt = new Date();
	job.progress = {
		current: totalChapters,
		total: totalChapters,
		message: `Successfully archived all ${totalChapters} chapters!`,
	};
	await job.save();
}

async function handleScrapeRawChapters(job: IBackgroundJob, novel: any) {
	const chaptersList = novel.rawChaptersList || [];
	const seenChapterNumbers = new Set<number>();
	const uniqueChapters = chaptersList.filter((chapter: any) => {
		const chapterNumber = Number(chapter.number);
		if (!Number.isFinite(chapterNumber) || seenChapterNumbers.has(chapterNumber) || !isHttpUrl(chapter.url)) {
			if (chapter.url && !isHttpUrl(chapter.url)) {
				console.warn(`[Worker] Skipping raw chapter ${chapter.number || "?"} with invalid URL: ${chapter.url}`);
			}
			return false;
		}

		seenChapterNumbers.add(chapterNumber);
		return true;
	});
	const totalChapters = uniqueChapters.length;

	if (totalChapters === 0) {
		throw new Error("No raw chapters listed on this novel. Run raw metadata scraper first.");
	}

	job.progress = {
		current: 0,
		total: totalChapters,
		message: `Processing ${totalChapters} raw chapters with ${CHAPTER_SCRAPE_CONCURRENCY} parallel browser pages...`,
	};
	await job.save();

	const existingChapters = await RawChapterContent.find({
		novelId: novel._id,
		chapterNumber: { $in: uniqueChapters.map((chapter: any) => chapter.number) },
	}).select("chapterNumber title");
	const existingChapterNumbers = new Set(existingChapters.map((chapter) => chapter.chapterNumber));
	const chapterIndexByNumber = new Map<number, any>(uniqueChapters.map((chapter: any) => [chapter.number, chapter]));
	const titleRepairOperations = existingChapters.flatMap((chapter) => {
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
		await RawChapterContent.bulkWrite(titleRepairOperations);
		console.log(`[Worker] Repaired ${titleRepairOperations.length} archived raw chapter title(s) from raw chapter index.`);
	}

	const pendingChapters = uniqueChapters.filter((chapter: any) => !existingChapterNumbers.has(chapter.number));
	const workerCount = Math.min(CHAPTER_SCRAPE_CONCURRENCY, pendingChapters.length);
	let completedCount = existingChapterNumbers.size;
	let nextChapterIndex = 0;
	let firstError: Error | null = null;

	const updateProgress = async (message: string) => {
		await BackgroundJob.updateOne(
			{ _id: job._id },
			{
				$set: {
					progress: {
						current: completedCount,
						total: totalChapters,
						message,
					},
				},
			},
		);
	};

	if (completedCount > 0) {
		await updateProgress(
			`Skipped ${completedCount} raw chapters already archived. Processing ${pendingChapters.length} remaining raw chapters...`,
		);
	}

	if (pendingChapters.length > 0) {
		console.log(`[Worker] Scraping ${pendingChapters.length} raw chapters with concurrency ${workerCount}.`);
	}

	async function scrapeWorker(workerIndex: number) {
		while (isRunning && !firstError) {
			const chapter = pendingChapters[nextChapterIndex++];
			if (!chapter) {
				return;
			}

			console.log(
				`[Worker] [${workerIndex + 1}/${workerCount}] Scraping raw chapter ${chapter.number}/${totalChapters}: ${chapter.title}`,
			);
			try {
				const scrapedChapter = await ScraperService.scrapeChapter(chapter.url);
				const chapterTitle = selectChapterTitle(chapter.title, scrapedChapter.title, novel.title, chapter.number);

				await RawChapterContent.updateOne(
					{
						novelId: novel._id,
						chapterNumber: chapter.number,
					},
					{
						$setOnInsert: {
							novelId: novel._id,
							chapterNumber: chapter.number,
							title: chapterTitle,
							content: scrapedChapter.content,
							sourceUrl: chapter.url,
							language: novel.rawOriginalLanguage || "",
							scrapedAt: new Date(),
						},
					},
					{ upsert: true },
				);

				completedCount++;
				await updateProgress(`Saved raw chapter ${chapter.number}: ${chapterTitle}`);

				if (DELAY_BETWEEN_CHAPTERS_MS > 0) {
					await sleep(DELAY_BETWEEN_CHAPTERS_MS);
				}
			} catch (chErr: any) {
				console.error(`[Worker] Error scraping raw chapter ${chapter.number} (${chapter.url}):`, chErr.message);
				firstError = new Error(`Failed on Raw Chapter ${chapter.number}: ${chErr.message}`);
				return;
			}
		}
	}

	await Promise.all(Array.from({ length: workerCount }, (_, index) => scrapeWorker(index)));

	if (!isRunning) {
		job.status = "pending";
		job.progress = {
			current: completedCount,
			total: totalChapters,
			message: "Worker stopped. Raw task suspended.",
		};
		await job.save();
		return;
	}

	if (firstError) {
		throw firstError;
	}

	job.status = "completed";
	job.completedAt = new Date();
	job.progress = {
		current: totalChapters,
		total: totalChapters,
		message: `Successfully archived all ${totalChapters} raw chapters!`,
	};
	await job.save();
}

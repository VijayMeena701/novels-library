import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { registerHandler, loginHandler, meHandler, updateMeHandler, googleLoginHandler, googleCallbackHandler } from "../controllers/authController.js";
import {
	listNovelsHandler,
	listCatalogNovelsHandler,
	getCatalogNovelHandler,
	addNovelToLibraryHandler,
	createNovelHandler,
	getNovelHandler,
	updateNovelHandler,
	updateCatalogNovelHandler,
	deleteNovelHandler,
	deleteCatalogNovelHandler,
	listReadingSessionsHandler,
	startReadingSessionHandler,
	updateReadingSessionHandler,
	listNovelSourcesHandler,
} from "../controllers/novelController.js";
import { listAuthorsHandler, getAuthorHandler, upsertAuthorHandler } from "../controllers/authorController.js";
import {
	listGenresHandler,
	getGenreHandler,
	upsertGenreHandler,
	listPublicationStatusesHandler,
	getPublicationStatusHandler,
	upsertPublicationStatusHandler,
} from "../controllers/taxonomyController.js";
import {
	listChaptersHandler,
	getChapterHandler,
	listRawChaptersHandler,
	getRawChapterHandler,
	listPublicChaptersHandler,
	getPublicChapterHandler,
	listPublicRawChaptersHandler,
	getPublicRawChapterHandler,
	listChapterVisitsHandler,
	recordChapterVisitHandler,
	translateRawChapterHandler,
} from "../controllers/chapterController.js";
import { getPublicNovelCoverHandler, syncNovelCoverHandler } from "../controllers/coverController.js";
import { getUserSettingsHandler, updateUserSettingsHandler } from "../controllers/settingsController.js";
import {
	listPronunciationRulesHandler,
	createPronunciationRuleHandler,
	updatePronunciationRuleHandler,
	deletePronunciationRuleHandler,
} from "../controllers/pronunciationRuleController.js";
import {
	importFailedChapterHtmlHandler,
	importChapterHtmlHandler,
	listJobsHandler,
	getJobsForNovelHandler,
	importMetadataHtmlHandler,
	importRawMetadataHtmlHandler,
	openManualInterventionHandler,
	retryJobHandler,
	runScrapeNowHandler,
	triggerScrapeHandler,
} from "../controllers/jobController.js";
import { CAPABILITY, requireCapability, onResponseAuditLog } from "../services/rbac.js";

/**
 * Authentication Hook to verify JWT
 */
async function authenticateHook(request: FastifyRequest, reply: FastifyReply) {
	try {
		await request.jwtVerify();
	} catch (err) {
		return reply.status(401).send({ error: "Unauthorized. Invalid or missing token." });
	}
}

export async function apiRoutes(fastify: FastifyInstance) {
	fastify.addHook("onResponse", onResponseAuditLog);

	// Public Auth Routes
	fastify.post("/auth/register", registerHandler);
	fastify.post("/auth/login", loginHandler);
	fastify.get("/auth/google", googleLoginHandler);
	fastify.get("/auth/google/callback", googleCallbackHandler);

	// Public Catalog & Taxonomy Routes
	fastify.get("/public/novels/:id/cover/:token", { preHandler: requireCapability(CAPABILITY.PUBLIC_CATALOG_READ, { allowAnonymous: true }) }, getPublicNovelCoverHandler);
	fastify.get("/public/catalog/novels", { preHandler: requireCapability(CAPABILITY.PUBLIC_CATALOG_READ, { allowAnonymous: true }) }, listCatalogNovelsHandler);
	fastify.get("/public/sources", { preHandler: requireCapability(CAPABILITY.PUBLIC_CATALOG_READ, { allowAnonymous: true }) }, listNovelSourcesHandler);
	fastify.get("/public/novels/:id", { preHandler: requireCapability(CAPABILITY.PUBLIC_CATALOG_READ, { allowAnonymous: true }) }, getCatalogNovelHandler);
	fastify.get("/public/novels/:id/chapters", { preHandler: requireCapability(CAPABILITY.PUBLIC_CATALOG_READ, { allowAnonymous: true }) }, listPublicChaptersHandler);
	fastify.get("/public/novels/:id/chapters/:chapterNumber", { preHandler: requireCapability(CAPABILITY.PUBLIC_CATALOG_READ, { allowAnonymous: true }) }, getPublicChapterHandler);
	fastify.get("/public/novels/:id/raw-chapters", { preHandler: requireCapability(CAPABILITY.PUBLIC_CATALOG_READ, { allowAnonymous: true }) }, listPublicRawChaptersHandler);
	fastify.get("/public/novels/:id/raw-chapters/:chapterNumber", { preHandler: requireCapability(CAPABILITY.PUBLIC_CATALOG_READ, { allowAnonymous: true }) }, getPublicRawChapterHandler);
	fastify.get("/public/authors", { preHandler: requireCapability(CAPABILITY.AUTHOR_READ, { allowAnonymous: true }) }, listAuthorsHandler);
	fastify.get("/public/authors/:id", { preHandler: requireCapability(CAPABILITY.AUTHOR_READ, { allowAnonymous: true }) }, getAuthorHandler);
	fastify.get("/public/genres", { preHandler: requireCapability(CAPABILITY.GENRE_READ, { allowAnonymous: true }) }, listGenresHandler);
	fastify.get("/public/genres/:keyOrId", { preHandler: requireCapability(CAPABILITY.GENRE_READ, { allowAnonymous: true }) }, getGenreHandler);
	fastify.get("/public/publication-statuses", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUS_READ, { allowAnonymous: true }) }, listPublicationStatusesHandler);
	fastify.get("/public/publication-statuses/:keyOrId", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUS_READ, { allowAnonymous: true }) }, getPublicationStatusHandler);

	// Protected Routes Group
	fastify.register(async (protectedGroup) => {
		protectedGroup.addHook("preValidation", authenticateHook);

		protectedGroup.get("/auth/me", { preHandler: requireCapability(CAPABILITY.AUTH_SELF) }, meHandler);
		protectedGroup.put("/auth/me", { preHandler: requireCapability(CAPABILITY.AUTH_SELF) }, updateMeHandler);

		protectedGroup.get("/settings", { preHandler: requireCapability(CAPABILITY.SETTINGS_READ) }, getUserSettingsHandler);
		protectedGroup.put("/settings", { preHandler: requireCapability(CAPABILITY.SETTINGS_UPDATE) }, updateUserSettingsHandler);

		protectedGroup.get("/novels", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, listNovelsHandler);
		protectedGroup.post("/novels", { preHandler: requireCapability(CAPABILITY.CATALOG_MANAGE) }, createNovelHandler);
		protectedGroup.post("/novels/:id/library", { preHandler: requireCapability(CAPABILITY.LIBRARY_ADD) }, addNovelToLibraryHandler);
		protectedGroup.get("/novels/:id", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, getNovelHandler);
		protectedGroup.put("/novels/:id", { preHandler: requireCapability(CAPABILITY.LIBRARY_UPDATE) }, updateNovelHandler);
		protectedGroup.delete("/novels/:id", { preHandler: requireCapability(CAPABILITY.LIBRARY_DELETE) }, deleteNovelHandler);
		protectedGroup.post("/novels/:id/cover/sync", { preHandler: requireCapability(CAPABILITY.COVER_SYNC) }, syncNovelCoverHandler);

		protectedGroup.get("/catalog/novels", { preHandler: requireCapability(CAPABILITY.PUBLIC_CATALOG_READ) }, listCatalogNovelsHandler);
		protectedGroup.put("/catalog/novels/:id", { preHandler: requireCapability(CAPABILITY.CATALOG_MANAGE) }, updateCatalogNovelHandler);
		protectedGroup.delete("/catalog/novels/:id", { preHandler: requireCapability(CAPABILITY.CATALOG_DELETE) }, deleteCatalogNovelHandler);
		protectedGroup.get("/authors", { preHandler: requireCapability(CAPABILITY.AUTHOR_READ) }, listAuthorsHandler);
		protectedGroup.get("/authors/:id", { preHandler: requireCapability(CAPABILITY.AUTHOR_READ) }, getAuthorHandler);
		protectedGroup.post("/authors", { preHandler: requireCapability(CAPABILITY.AUTHOR_MANAGE) }, upsertAuthorHandler);
		protectedGroup.put("/authors/:id", { preHandler: requireCapability(CAPABILITY.AUTHOR_MANAGE) }, upsertAuthorHandler);
		protectedGroup.get("/genres", { preHandler: requireCapability(CAPABILITY.GENRE_READ) }, listGenresHandler);
		protectedGroup.get("/genres/:keyOrId", { preHandler: requireCapability(CAPABILITY.GENRE_READ) }, getGenreHandler);
		protectedGroup.post("/genres", { preHandler: requireCapability(CAPABILITY.GENRE_MANAGE) }, upsertGenreHandler);
		protectedGroup.put("/genres/:id", { preHandler: requireCapability(CAPABILITY.GENRE_MANAGE) }, upsertGenreHandler);
		protectedGroup.get("/publication-statuses", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUS_READ) }, listPublicationStatusesHandler);
		protectedGroup.get("/publication-statuses/:keyOrId", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUS_READ) }, getPublicationStatusHandler);
		protectedGroup.post("/publication-statuses", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUS_MANAGE) }, upsertPublicationStatusHandler);
		protectedGroup.put("/publication-statuses/:id", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUS_MANAGE) }, upsertPublicationStatusHandler);

		protectedGroup.get("/novels/:id/re-read", { preHandler: requireCapability(CAPABILITY.SESSION_READ) }, listReadingSessionsHandler);
		protectedGroup.post("/novels/:id/re-read", { preHandler: requireCapability(CAPABILITY.SESSION_MANAGE) }, startReadingSessionHandler);
		protectedGroup.put("/novels/:id/re-read/:sessionId", { preHandler: requireCapability(CAPABILITY.SESSION_MANAGE) }, updateReadingSessionHandler);

		protectedGroup.get("/novels/:id/pronunciation-rules", { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_READ) }, listPronunciationRulesHandler);
		protectedGroup.post("/novels/:id/pronunciation-rules", { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_MANAGE) }, createPronunciationRuleHandler);
		protectedGroup.put("/pronunciation-rules/:ruleId", { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_MANAGE) }, updatePronunciationRuleHandler);
		protectedGroup.delete("/pronunciation-rules/:ruleId", { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_MANAGE) }, deletePronunciationRuleHandler);

		protectedGroup.get("/novels/:id/chapters", { preHandler: requireCapability(CAPABILITY.CHAPTER_READ) }, listChaptersHandler);
		protectedGroup.get("/novels/:id/chapters/:chapterNumber", { preHandler: requireCapability(CAPABILITY.CHAPTER_READ) }, getChapterHandler);
		protectedGroup.get("/novels/:id/raw-chapters", { preHandler: requireCapability(CAPABILITY.CHAPTER_READ_RAW) }, listRawChaptersHandler);
		protectedGroup.get("/novels/:id/raw-chapters/:chapterNumber", { preHandler: requireCapability(CAPABILITY.CHAPTER_READ_RAW) }, getRawChapterHandler);
		protectedGroup.post("/novels/:id/raw-chapters/:chapterNumber/translate", { preHandler: requireCapability(CAPABILITY.CHAPTER_TRANSLATE) }, translateRawChapterHandler);
		protectedGroup.get("/novels/:id/chapter-visits", { preHandler: requireCapability(CAPABILITY.CHAPTER_VISIT) }, listChapterVisitsHandler);
		protectedGroup.post("/novels/:id/chapters/:chapterNumber/visits", { preHandler: requireCapability(CAPABILITY.CHAPTER_VISIT) }, recordChapterVisitHandler);

		protectedGroup.get("/jobs", { preHandler: requireCapability(CAPABILITY.JOB_READ) }, listJobsHandler);
		protectedGroup.get("/jobs/novel/:novelId", { preHandler: requireCapability(CAPABILITY.JOB_READ) }, getJobsForNovelHandler);
		protectedGroup.post("/jobs/:jobId/retry", { preHandler: requireCapability(CAPABILITY.JOB_RETRY) }, retryJobHandler);
		protectedGroup.post("/jobs/:jobId/manual-intervention", { preHandler: requireCapability(CAPABILITY.JOB_MANUAL_INTERVENTION) }, openManualInterventionHandler);
		protectedGroup.post("/jobs/:jobId/import-chapter-html", { preHandler: requireCapability(CAPABILITY.JOB_IMPORT), bodyLimit: 20 * 1024 * 1024 }, importFailedChapterHtmlHandler);
		protectedGroup.post("/jobs/novel/:novelId/import-html-index", { preHandler: requireCapability(CAPABILITY.JOB_IMPORT), bodyLimit: 20 * 1024 * 1024 }, importMetadataHtmlHandler);
		protectedGroup.post("/jobs/novel/:novelId/import-raw-html", { preHandler: requireCapability(CAPABILITY.JOB_IMPORT), bodyLimit: 20 * 1024 * 1024 }, importRawMetadataHtmlHandler);
		protectedGroup.post("/jobs/novel/:novelId/import-chapter-html", { preHandler: requireCapability(CAPABILITY.JOB_IMPORT), bodyLimit: 20 * 1024 * 1024 }, importChapterHtmlHandler);
		protectedGroup.post("/jobs/novel/:novelId/scrape-now", { preHandler: requireCapability(CAPABILITY.JOB_SCRAPE) }, runScrapeNowHandler);
		protectedGroup.post("/jobs/novel/:novelId/scrape", { preHandler: requireCapability(CAPABILITY.JOB_SCRAPE) }, triggerScrapeHandler);
	});
}

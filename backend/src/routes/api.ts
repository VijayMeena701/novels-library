import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { User } from "../models/User.js";
import { registerHandler, loginHandler, meHandler, updateMeHandler, getCapabilitiesHandler, googleLoginHandler, googleCallbackHandler } from "../controllers/authController.js";
import {
	listBooksHandler,
	listCatalogBooksHandler,
	getCatalogBookHandler,
	getBookReviewsHandler,
	addBookToLibraryHandler,
	createBookHandler,
	getBookHandler,
	updateBookHandler,
	updateCatalogBookHandler,
	deleteBookHandler,
	deleteCatalogBookHandler,
	voteBookHandler,
	listReadingSessionsHandler,
	startReadingSessionHandler,
	updateReadingSessionHandler,
	listBookSourcesHandler,
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
import { getPublicBookCoverHandler, syncBookCoverHandler } from "../controllers/coverController.js";
import { getUserSettingsHandler, updateUserSettingsHandler } from "../controllers/settingsController.js";
import {
	listPronunciationRulesHandler,
	createPronunciationRuleHandler,
	updatePronunciationRuleHandler,
	deletePronunciationRuleHandler,
} from "../controllers/pronunciationRuleController.js";
import { getHomeHandler } from "../controllers/homeController.js";
import { getHistoryHandler } from "../controllers/historyController.js";
import {
	getNotificationsHandler,
	markNotificationReadHandler,
	markAllNotificationsReadHandler,
} from "../controllers/notificationController.js";
import {
	createReportHandler,
	listReportsHandler,
	updateReportStatusHandler,
} from "../controllers/reportController.js";
import {
	createBookRequestHandler,
	listBookRequestsHandler,
	voteBookRequestHandler,
} from "../controllers/requestController.js";
import {
	importFailedChapterHtmlHandler,
	importChapterHtmlHandler,
	listJobsHandler,
	getJobsForBookHandler,
	importMetadataHtmlHandler,
	importRawMetadataHtmlHandler,
	openManualInterventionHandler,
	retryJobHandler,
	runScrapeNowHandler,
	triggerScrapeHandler,
} from "../controllers/jobController.js";
import {
  getAdminStatsHandler,
  listUsersHandler,
  getUserByIdHandler,
  updateUserHandler,
  deleteUserHandler,
  listRolesHandler,
  createRoleHandler,
  updateRoleHandler,
  deleteRoleHandler,
  listGroupsHandler,
  createGroupHandler,
  updateGroupHandler,
  deleteGroupHandler,
  listResourcesHandler,
  enableResourceHandler,
  listAuditLogsHandler,
} from "../controllers/adminController.js";
import { CAPABILITY, requireCapability, onResponseAuditLog } from "../services/rbac.js";

/**
 * Authentication Hook to verify JWT
 */
async function authenticateHook(request: FastifyRequest, reply: FastifyReply) {
	try {
		await request.jwtVerify();
		const userId = (request.user as any)?.id;
		if (userId) {
			const user = await User.findById(userId).select('isDisabled isDeleted isLocked email').populate('roles', 'isSuperuser key');
			if (!user || user.isDeleted || user.isDisabled || user.isLocked) {
				return reply.status(401).send({ error: "Account is inactive or locked." });
			}
			const isSuperuser = (user.roles || []).some((r: any) => r.isSuperuser);
			(request as any).user = {
				id: String(user._id),
				email: user.email,
				isSuperuser,
				role: (user.roles || []).map((r: any) => r.key).join(','),
			};
		}
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
	fastify.get("/public/books/:id/cover/:token", { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) }, getPublicBookCoverHandler);
	fastify.get("/public/catalog/books", { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) }, listCatalogBooksHandler);
	fastify.get("/public/sources", { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) }, listBookSourcesHandler);
	fastify.get("/home", { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) }, getHomeHandler);
	fastify.get("/public/books/:id", { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) }, getCatalogBookHandler);
	fastify.get("/public/books/:id/reviews", { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) }, getBookReviewsHandler);
	fastify.get("/public/books/:id/chapters", { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ, { allowAnonymous: true }) }, listPublicChaptersHandler);
	fastify.get("/public/books/:id/chapters/:chapterNumber", { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ, { allowAnonymous: true }) }, getPublicChapterHandler);
	fastify.get("/public/books/:id/raw-chapters", { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ_RAW, { allowAnonymous: true }) }, listPublicRawChaptersHandler);
	fastify.get("/public/books/:id/raw-chapters/:chapterNumber", { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ_RAW, { allowAnonymous: true }) }, getPublicRawChapterHandler);
	fastify.get("/public/authors", { preHandler: requireCapability(CAPABILITY.AUTHORS_READ, { allowAnonymous: true }) }, listAuthorsHandler);
	fastify.get("/public/authors/:id", { preHandler: requireCapability(CAPABILITY.AUTHORS_READ, { allowAnonymous: true }) }, getAuthorHandler);
	fastify.get("/public/genres", { preHandler: requireCapability(CAPABILITY.GENRES_READ, { allowAnonymous: true }) }, listGenresHandler);
	fastify.get("/public/genres/:keyOrId", { preHandler: requireCapability(CAPABILITY.GENRES_READ, { allowAnonymous: true }) }, getGenreHandler);
	fastify.get("/public/publication-statuses", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_READ, { allowAnonymous: true }) }, listPublicationStatusesHandler);
	fastify.get("/public/publication-statuses/:keyOrId", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_READ, { allowAnonymous: true }) }, getPublicationStatusHandler);

	// Protected Routes Group
	fastify.register(async (protectedGroup) => {
		protectedGroup.addHook("preValidation", authenticateHook);

		protectedGroup.get("/auth/me", { preHandler: requireCapability(CAPABILITY.PROFILE_READ) }, meHandler);
		protectedGroup.put("/auth/me", { preHandler: requireCapability(CAPABILITY.PROFILE_UPDATE) }, updateMeHandler);
		protectedGroup.get("/auth/capabilities", { preHandler: requireCapability(CAPABILITY.PROFILE_READ) }, getCapabilitiesHandler);

		protectedGroup.get("/settings", { preHandler: requireCapability(CAPABILITY.SETTINGS_READ) }, getUserSettingsHandler);
		protectedGroup.put("/settings", { preHandler: requireCapability(CAPABILITY.SETTINGS_UPDATE) }, updateUserSettingsHandler);
		protectedGroup.get("/history", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, getHistoryHandler);
		protectedGroup.get("/notifications", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, getNotificationsHandler);
		protectedGroup.put("/notifications/:id/read", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, markNotificationReadHandler);
		protectedGroup.put("/notifications/read-all", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, markAllNotificationsReadHandler);

		protectedGroup.get("/books", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, listBooksHandler);
		protectedGroup.post("/books/:id/report", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, createReportHandler);
		protectedGroup.get("/reports", { preHandler: requireCapability(CAPABILITY.BOOKS_MANAGE) }, listReportsHandler);
		protectedGroup.put("/reports/:id/status", { preHandler: requireCapability(CAPABILITY.BOOKS_MANAGE) }, updateReportStatusHandler);
		protectedGroup.get("/requests", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, listBookRequestsHandler);
		protectedGroup.post("/requests", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, createBookRequestHandler);
		protectedGroup.post("/requests/:id/vote", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, voteBookRequestHandler);
		protectedGroup.post("/books", { preHandler: requireCapability(CAPABILITY.BOOKS_CREATE) }, createBookHandler);
		protectedGroup.post("/books/:id/library", { preHandler: requireCapability(CAPABILITY.LIBRARY_ADD) }, addBookToLibraryHandler);
		protectedGroup.get("/books/:id", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, getBookHandler);
		protectedGroup.post("/books/:id/vote", { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, voteBookHandler);
		protectedGroup.put("/books/:id", { preHandler: requireCapability(CAPABILITY.LIBRARY_UPDATE) }, updateBookHandler);
		protectedGroup.delete("/books/:id", { preHandler: requireCapability(CAPABILITY.LIBRARY_DELETE) }, deleteBookHandler);
		protectedGroup.post("/books/:id/cover/sync", { preHandler: requireCapability(CAPABILITY.COVER_SYNC) }, syncBookCoverHandler);

		protectedGroup.get("/catalog/books", { preHandler: requireCapability(CAPABILITY.BOOKS_LIST) }, listCatalogBooksHandler);
		protectedGroup.put("/catalog/books/:id", { preHandler: requireCapability(CAPABILITY.BOOKS_UPDATE) }, updateCatalogBookHandler);
		protectedGroup.delete("/catalog/books/:id", { preHandler: requireCapability(CAPABILITY.BOOKS_DELETE) }, deleteCatalogBookHandler);
		protectedGroup.get("/authors", { preHandler: requireCapability(CAPABILITY.AUTHORS_READ) }, listAuthorsHandler);
		protectedGroup.get("/authors/:id", { preHandler: requireCapability(CAPABILITY.AUTHORS_READ) }, getAuthorHandler);
		protectedGroup.post("/authors", { preHandler: requireCapability(CAPABILITY.AUTHORS_MANAGE) }, upsertAuthorHandler);
		protectedGroup.put("/authors/:id", { preHandler: requireCapability(CAPABILITY.AUTHORS_MANAGE) }, upsertAuthorHandler);
		protectedGroup.get("/genres", { preHandler: requireCapability(CAPABILITY.GENRES_READ) }, listGenresHandler);
		protectedGroup.get("/genres/:keyOrId", { preHandler: requireCapability(CAPABILITY.GENRES_READ) }, getGenreHandler);
		protectedGroup.post("/genres", { preHandler: requireCapability(CAPABILITY.GENRES_MANAGE) }, upsertGenreHandler);
		protectedGroup.put("/genres/:id", { preHandler: requireCapability(CAPABILITY.GENRES_MANAGE) }, upsertGenreHandler);
		protectedGroup.get("/publication-statuses", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_READ) }, listPublicationStatusesHandler);
		protectedGroup.get("/publication-statuses/:keyOrId", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_READ) }, getPublicationStatusHandler);
		protectedGroup.post("/publication-statuses", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_MANAGE) }, upsertPublicationStatusHandler);
		protectedGroup.put("/publication-statuses/:id", { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_MANAGE) }, upsertPublicationStatusHandler);

		protectedGroup.get("/books/:id/re-read", { preHandler: requireCapability(CAPABILITY.SESSIONS_READ) }, listReadingSessionsHandler);
		protectedGroup.post("/books/:id/re-read", { preHandler: requireCapability(CAPABILITY.SESSIONS_MANAGE) }, startReadingSessionHandler);
		protectedGroup.put("/books/:id/re-read/:sessionId", { preHandler: requireCapability(CAPABILITY.SESSIONS_MANAGE) }, updateReadingSessionHandler);

		protectedGroup.get("/books/:id/pronunciation-rules", { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_READ) }, listPronunciationRulesHandler);
		protectedGroup.post("/books/:id/pronunciation-rules", { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_MANAGE) }, createPronunciationRuleHandler);
		protectedGroup.put("/pronunciation-rules/:ruleId", { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_MANAGE) }, updatePronunciationRuleHandler);
		protectedGroup.delete("/pronunciation-rules/:ruleId", { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_MANAGE) }, deletePronunciationRuleHandler);

		protectedGroup.get("/books/:id/chapters", { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ) }, listChaptersHandler);
		protectedGroup.get("/books/:id/chapters/:chapterNumber", { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ) }, getChapterHandler);
		protectedGroup.get("/books/:id/raw-chapters", { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ_RAW) }, listRawChaptersHandler);
		protectedGroup.get("/books/:id/raw-chapters/:chapterNumber", { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ_RAW) }, getRawChapterHandler);
		protectedGroup.post("/books/:id/raw-chapters/:chapterNumber/translate", { preHandler: requireCapability(CAPABILITY.CHAPTERS_TRANSLATE) }, translateRawChapterHandler);
		protectedGroup.get("/books/:id/visits", { preHandler: requireCapability(CAPABILITY.CHAPTERS_VISIT) }, listChapterVisitsHandler);
		protectedGroup.post("/books/:id/chapters/:chapterNumber/visits", { preHandler: requireCapability(CAPABILITY.CHAPTERS_VISIT) }, recordChapterVisitHandler);

		protectedGroup.get("/jobs", { preHandler: requireCapability(CAPABILITY.JOBS_LIST) }, listJobsHandler);
		protectedGroup.get("/jobs/book/:bookId", { preHandler: requireCapability(CAPABILITY.JOBS_LIST) }, getJobsForBookHandler);
		protectedGroup.post("/jobs/:jobId/retry", { preHandler: requireCapability(CAPABILITY.JOBS_RETRY) }, retryJobHandler);
		protectedGroup.post("/jobs/:jobId/manual-intervention", { preHandler: requireCapability(CAPABILITY.JOBS_MANUAL_INTERVENTION) }, openManualInterventionHandler);
		protectedGroup.post("/jobs/:jobId/import-chapter-html", { preHandler: requireCapability(CAPABILITY.JOBS_IMPORT), bodyLimit: 20 * 1024 * 1024 }, importFailedChapterHtmlHandler);
		protectedGroup.post("/jobs/book/:bookId/import-html-index", { preHandler: requireCapability(CAPABILITY.JOBS_IMPORT), bodyLimit: 20 * 1024 * 1024 }, importMetadataHtmlHandler);
		protectedGroup.post("/jobs/book/:bookId/import-raw-html", { preHandler: requireCapability(CAPABILITY.JOBS_IMPORT), bodyLimit: 20 * 1024 * 1024 }, importRawMetadataHtmlHandler);
		protectedGroup.post("/jobs/book/:bookId/import-chapter-html", { preHandler: requireCapability(CAPABILITY.JOBS_IMPORT), bodyLimit: 20 * 1024 * 1024 }, importChapterHtmlHandler);
		protectedGroup.post("/jobs/book/:bookId/scrape-now", { preHandler: requireCapability(CAPABILITY.JOBS_SCRAPE) }, runScrapeNowHandler);
		protectedGroup.post("/jobs/book/:bookId/scrape", { preHandler: requireCapability(CAPABILITY.JOBS_SCRAPE) }, triggerScrapeHandler);

		// Admin Console Routes
		protectedGroup.get("/admin", { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, getAdminStatsHandler);
		protectedGroup.get("/admin/users", { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listUsersHandler);
		protectedGroup.get("/admin/users/:id", { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, getUserByIdHandler);
		protectedGroup.put("/admin/users/:id", { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, updateUserHandler);
		protectedGroup.delete("/admin/users/:id", { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, deleteUserHandler);
		protectedGroup.get("/admin/roles", { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listRolesHandler);
		protectedGroup.post("/admin/roles", { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, createRoleHandler);
		protectedGroup.put("/admin/roles/:id", { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, updateRoleHandler);
		protectedGroup.delete("/admin/roles/:id", { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, deleteRoleHandler);
		protectedGroup.get("/admin/groups", { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listGroupsHandler);
		protectedGroup.post("/admin/groups", { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, createGroupHandler);
		protectedGroup.put("/admin/groups/:id", { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, updateGroupHandler);
		protectedGroup.delete("/admin/groups/:id", { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, deleteGroupHandler);
		protectedGroup.get("/admin/resources", { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listResourcesHandler);
		protectedGroup.put("/admin/resources/:id/enable", { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, enableResourceHandler);
		protectedGroup.get("/admin/audit-logs", { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listAuditLogsHandler);
	});
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  registerHandler,
  loginHandler,
  meHandler,
  googleLoginHandler,
  googleCallbackHandler
} from '../controllers/authController.js';
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
  updateReadingSessionHandler
} from '../controllers/novelController.js';
import { listAuthorsHandler, getAuthorHandler, upsertAuthorHandler } from '../controllers/authorController.js';
import {
  listGenresHandler,
  getGenreHandler,
  upsertGenreHandler,
  listPublicationStatusesHandler,
  getPublicationStatusHandler,
  upsertPublicationStatusHandler,
} from '../controllers/taxonomyController.js';
import {
  listChaptersHandler,
  getChapterHandler,
  listPublicChaptersHandler,
  getPublicChapterHandler,
  listChapterVisitsHandler,
  recordChapterVisitHandler
} from '../controllers/chapterController.js';
import { getPublicNovelCoverHandler, syncNovelCoverHandler } from '../controllers/coverController.js';
import { getUserSettingsHandler, updateUserSettingsHandler } from '../controllers/settingsController.js';
import { 
  listJobsHandler, 
  getJobsForNovelHandler, 
  retryJobHandler, 
  triggerScrapeHandler 
} from '../controllers/jobController.js';

/**
 * Authentication Hook to verify JWT
 */
async function authenticateHook(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized. Invalid or missing token.' });
  }
}

export async function apiRoutes(fastify: FastifyInstance) {
  // Public Auth Routes
  fastify.post('/auth/register', registerHandler);
  fastify.post('/auth/login', loginHandler);
  fastify.get('/auth/google', googleLoginHandler);
  fastify.get('/auth/google/callback', googleCallbackHandler);
  fastify.get('/public/novels/:id/cover/:token', getPublicNovelCoverHandler);
  fastify.get('/public/catalog/novels', listCatalogNovelsHandler);
  fastify.get('/public/novels/:id', getCatalogNovelHandler);
  fastify.get('/public/novels/:id/chapters', listPublicChaptersHandler);
  fastify.get('/public/novels/:id/chapters/:chapterNumber', getPublicChapterHandler);
  fastify.get('/public/authors', listAuthorsHandler);
  fastify.get('/public/authors/:id', getAuthorHandler);
  fastify.get('/public/genres', listGenresHandler);
  fastify.get('/public/genres/:keyOrId', getGenreHandler);
  fastify.get('/public/publication-statuses', listPublicationStatusesHandler);
  fastify.get('/public/publication-statuses/:keyOrId', getPublicationStatusHandler);

  // Protected Routes Group
  fastify.register(async (protectedGroup) => {
    // Apply authentication hook to all routes in this sub-registry
    protectedGroup.addHook('preValidation', authenticateHook);

    // Auth verification
    protectedGroup.get('/auth/me', meHandler);

    // User Settings Routes
    protectedGroup.get('/settings', getUserSettingsHandler);
    protectedGroup.put('/settings', updateUserSettingsHandler);

    // Novels Tracker Routes
    protectedGroup.get('/novels', listNovelsHandler);
    protectedGroup.post('/novels', createNovelHandler);
    protectedGroup.post('/novels/:id/library', addNovelToLibraryHandler);
    protectedGroup.get('/novels/:id', getNovelHandler);
    protectedGroup.put('/novels/:id', updateNovelHandler);
    protectedGroup.delete('/novels/:id', deleteNovelHandler);
    protectedGroup.post('/novels/:id/cover/sync', syncNovelCoverHandler);

    // Catalog Browse Routes
    protectedGroup.get('/catalog/novels', listCatalogNovelsHandler);
    protectedGroup.put('/catalog/novels/:id', updateCatalogNovelHandler);
    protectedGroup.delete('/catalog/novels/:id', deleteCatalogNovelHandler);
    protectedGroup.get('/authors', listAuthorsHandler);
    protectedGroup.get('/authors/:id', getAuthorHandler);
    protectedGroup.post('/authors', upsertAuthorHandler);
    protectedGroup.put('/authors/:id', upsertAuthorHandler);
    protectedGroup.get('/genres', listGenresHandler);
    protectedGroup.get('/genres/:keyOrId', getGenreHandler);
    protectedGroup.post('/genres', upsertGenreHandler);
    protectedGroup.put('/genres/:id', upsertGenreHandler);
    protectedGroup.get('/publication-statuses', listPublicationStatusesHandler);
    protectedGroup.get('/publication-statuses/:keyOrId', getPublicationStatusHandler);
    protectedGroup.post('/publication-statuses', upsertPublicationStatusHandler);
    protectedGroup.put('/publication-statuses/:id', upsertPublicationStatusHandler);

    // Re-reading Sessions Logs Routes
    protectedGroup.get('/novels/:id/re-read', listReadingSessionsHandler);
    protectedGroup.post('/novels/:id/re-read', startReadingSessionHandler);
    protectedGroup.put('/novels/:id/re-read/:sessionId', updateReadingSessionHandler);

    // Archived Chapters Content Routes
    protectedGroup.get('/novels/:id/chapters', listChaptersHandler);
    protectedGroup.get('/novels/:id/chapters/:chapterNumber', getChapterHandler);
    protectedGroup.get('/novels/:id/chapter-visits', listChapterVisitsHandler);
    protectedGroup.post('/novels/:id/chapters/:chapterNumber/visits', recordChapterVisitHandler);

    // Background Queue Job Logs & Sync triggers
    protectedGroup.get('/jobs', listJobsHandler);
    protectedGroup.get('/jobs/novel/:novelId', getJobsForNovelHandler);
    protectedGroup.post('/jobs/:jobId/retry', retryJobHandler);
    protectedGroup.post('/jobs/novel/:novelId/scrape', triggerScrapeHandler);
  });
}

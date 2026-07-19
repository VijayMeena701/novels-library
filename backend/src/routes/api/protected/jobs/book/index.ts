import { FastifyInstance } from 'fastify';
import { protectedJobBookDetailRoutes } from './detail';
import { protectedJobBookImportHtmlIndexRoutes } from './import-html-index';
import { protectedJobBookImportRawHtmlRoutes } from './import-raw-html';
import { protectedJobBookImportChapterHtmlRoutes } from './import-chapter-html';
import { protectedJobBookScrapeNowRoutes } from './scrape-now';
import { protectedJobBookScrapeRoutes } from './scrape';

export async function protectedJobBookRoutes(fastify: FastifyInstance) {
  fastify.register(protectedJobBookDetailRoutes, { prefix: '/:bookId' });
  fastify.register(protectedJobBookImportHtmlIndexRoutes, { prefix: '/:bookId/import-html-index' });
  fastify.register(protectedJobBookImportRawHtmlRoutes, { prefix: '/:bookId/import-raw-html' });
  fastify.register(protectedJobBookImportChapterHtmlRoutes, { prefix: '/:bookId/import-chapter-html' });
  fastify.register(protectedJobBookScrapeNowRoutes, { prefix: '/:bookId/scrape-now' });
  fastify.register(protectedJobBookScrapeRoutes, { prefix: '/:bookId/scrape' });
}

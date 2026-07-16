import { FastifyInstance } from 'fastify';
import {
  listBooksHandler,
  createBookHandler,
} from '@/controllers/novelController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedBookDetailRoutes } from './detail';
import { protectedBookReportRoutes } from './report';
import { protectedBookLibraryRoutes } from './library';
import { protectedBookVoteRoutes } from './vote';
import { protectedBookCoverRoutes } from './cover';
import { protectedBookReadingSessionRoutes } from './re-read';
import { protectedBookPronunciationRuleRoutes } from './pronunciation-rules';
import { protectedBookChapterRoutes } from './chapters';
import { protectedBookRawChapterRoutes } from './raw-chapters';
import { protectedBookVisitRoutes } from './visits';

export async function protectedBookRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, listBooksHandler);
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.BOOKS_CREATE) }, createBookHandler);

  fastify.register(protectedBookDetailRoutes, { prefix: '/:id' });
  fastify.register(protectedBookReportRoutes, { prefix: '/:id/report' });
  fastify.register(protectedBookLibraryRoutes, { prefix: '/:id/library' });
  fastify.register(protectedBookVoteRoutes, { prefix: '/:id/vote' });
  fastify.register(protectedBookCoverRoutes, { prefix: '/:id/cover' });
  fastify.register(protectedBookReadingSessionRoutes, { prefix: '/:id/re-read' });
  fastify.register(protectedBookPronunciationRuleRoutes, { prefix: '/:id/pronunciation-rules' });
  fastify.register(protectedBookChapterRoutes, { prefix: '/:id/chapters' });
  fastify.register(protectedBookRawChapterRoutes, { prefix: '/:id/raw-chapters' });
  fastify.register(protectedBookVisitRoutes, { prefix: '/:id/visits' });
}

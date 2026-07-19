import { FastifyInstance } from 'fastify';
import { listChaptersHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedBookChapterDetailRoutes } from './detail';
import { protectedBookChapterVisitRoutes } from './visits';

export async function protectedBookChapterRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ) }, listChaptersHandler);

  fastify.register(protectedBookChapterDetailRoutes, { prefix: '/:chapterNumber' });
  fastify.register(protectedBookChapterVisitRoutes, { prefix: '/:chapterNumber/visits' });
}

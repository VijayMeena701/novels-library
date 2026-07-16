import { FastifyInstance } from 'fastify';
import { listPublicChaptersHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { publicBookChapterDetailRoutes } from './detail';

export async function publicBookChapterRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ, { allowAnonymous: true }) },
    listPublicChaptersHandler,
  );

  fastify.register(publicBookChapterDetailRoutes, { prefix: '/:chapterNumber' });
}

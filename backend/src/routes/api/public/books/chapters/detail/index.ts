import { FastifyInstance } from 'fastify';
import { getPublicChapterHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicBookChapterDetailRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ, { allowAnonymous: true }) },
    getPublicChapterHandler,
  );
}

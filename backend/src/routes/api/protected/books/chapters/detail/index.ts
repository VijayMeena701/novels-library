import { FastifyInstance } from 'fastify';
import { getChapterHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookChapterDetailRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ) },
    getChapterHandler,
  );
}

import { FastifyInstance } from 'fastify';
import { getPublicRawChapterHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicBookRawChapterDetailRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ_RAW, { allowAnonymous: true }) },
    getPublicRawChapterHandler,
  );
}

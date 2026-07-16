import { FastifyInstance } from 'fastify';
import { getRawChapterHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookRawChapterDetailRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ_RAW) },
    getRawChapterHandler,
  );
}

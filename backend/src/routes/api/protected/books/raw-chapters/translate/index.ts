import { FastifyInstance } from 'fastify';
import { translateRawChapterHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookRawChapterTranslateRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.CHAPTERS_TRANSLATE) },
    translateRawChapterHandler,
  );
}

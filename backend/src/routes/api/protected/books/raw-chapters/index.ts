import { FastifyInstance } from 'fastify';
import { listRawChaptersHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedBookRawChapterDetailRoutes } from './detail';
import { protectedBookRawChapterTranslateRoutes } from './translate';

export async function protectedBookRawChapterRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ_RAW) },
    listRawChaptersHandler,
  );

  fastify.register(protectedBookRawChapterDetailRoutes, { prefix: '/:chapterNumber' });
  fastify.register(protectedBookRawChapterTranslateRoutes, { prefix: '/:chapterNumber/translate' });
}

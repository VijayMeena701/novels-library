import { FastifyInstance } from 'fastify';
import { listPublicRawChaptersHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { publicBookRawChapterDetailRoutes } from './detail';

export async function publicBookRawChapterRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.CHAPTERS_READ_RAW, { allowAnonymous: true }) },
    listPublicRawChaptersHandler,
  );

  fastify.register(publicBookRawChapterDetailRoutes, { prefix: '/:chapterNumber' });
}

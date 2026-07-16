import { FastifyInstance } from 'fastify';
import { listChapterVisitsHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookVisitRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.CHAPTERS_VISIT) },
    listChapterVisitsHandler,
  );
}

import { FastifyInstance } from 'fastify';
import { recordChapterVisitHandler } from '@/controllers/chapterController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookChapterVisitRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.CHAPTERS_VISIT) },
    recordChapterVisitHandler,
  );
}

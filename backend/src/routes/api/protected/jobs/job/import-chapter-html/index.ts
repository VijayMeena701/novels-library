import { FastifyInstance } from 'fastify';
import { importFailedChapterHtmlHandler } from '@/controllers/jobController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedJobImportChapterHtmlRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.JOBS_IMPORT), bodyLimit: 20 * 1024 * 1024 },
    importFailedChapterHtmlHandler,
  );
}

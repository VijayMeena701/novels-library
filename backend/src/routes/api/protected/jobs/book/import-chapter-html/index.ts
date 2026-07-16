import { FastifyInstance } from 'fastify';
import { importChapterHtmlHandler } from '@/controllers/jobController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedJobBookImportChapterHtmlRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.JOBS_IMPORT), bodyLimit: 20 * 1024 * 1024 },
    importChapterHtmlHandler,
  );
}

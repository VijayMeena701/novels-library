import { FastifyInstance } from 'fastify';
import { updateReportStatusHandler } from '@/controllers/reportController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedReportStatusRoutes(fastify: FastifyInstance) {
  fastify.put(
    '/',
    { preHandler: requireCapability(CAPABILITY.BOOKS_MANAGE) },
    updateReportStatusHandler,
  );
}

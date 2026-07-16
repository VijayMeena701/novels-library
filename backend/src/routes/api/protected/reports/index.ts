import { FastifyInstance } from 'fastify';
import { listReportsHandler } from '@/controllers/reportController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedReportStatusRoutes } from './status';

export async function protectedReportRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.BOOKS_MANAGE) }, listReportsHandler);

  fastify.register(protectedReportStatusRoutes, { prefix: '/:id/status' });
}

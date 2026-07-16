import { FastifyInstance } from 'fastify';
import { createReportHandler } from '@/controllers/reportController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookReportRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) },
    createReportHandler,
  );
}

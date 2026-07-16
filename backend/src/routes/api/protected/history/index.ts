import { FastifyInstance } from 'fastify';
import { getHistoryHandler } from '@/controllers/historyController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedHistoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, getHistoryHandler);
}

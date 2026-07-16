import { FastifyInstance } from 'fastify';
import { retryJobHandler } from '@/controllers/jobController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedJobRetryRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.JOBS_RETRY) }, retryJobHandler);
}

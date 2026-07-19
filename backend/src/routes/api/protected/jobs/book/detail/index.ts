import { FastifyInstance } from 'fastify';
import { getJobsForBookHandler } from '@/controllers/jobController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedJobBookDetailRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.JOBS_LIST) }, getJobsForBookHandler);
}

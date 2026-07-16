import { FastifyInstance } from 'fastify';
import { listJobsHandler } from '@/controllers/jobController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedJobBookRoutes } from './book';
import { protectedJobActionRoutes } from './job';

export async function protectedJobRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.JOBS_LIST) }, listJobsHandler);

  fastify.register(protectedJobBookRoutes, { prefix: '/book' });
  fastify.register(protectedJobActionRoutes, { prefix: '/:jobId' });
}

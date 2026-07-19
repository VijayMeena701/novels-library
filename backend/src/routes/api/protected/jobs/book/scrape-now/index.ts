import { FastifyInstance } from 'fastify';
import { runScrapeNowHandler } from '@/controllers/jobController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedJobBookScrapeNowRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.JOBS_SCRAPE) }, runScrapeNowHandler);
}

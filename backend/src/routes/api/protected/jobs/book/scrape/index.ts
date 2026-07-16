import { FastifyInstance } from 'fastify';
import { triggerScrapeHandler } from '@/controllers/jobController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedJobBookScrapeRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.JOBS_SCRAPE) }, triggerScrapeHandler);
}

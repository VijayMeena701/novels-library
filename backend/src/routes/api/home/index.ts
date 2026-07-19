import { FastifyInstance } from 'fastify';
import { getHomeHandler } from '@/controllers/homeController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function homeRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) },
    getHomeHandler,
  );
}

import { FastifyInstance } from 'fastify';
import { listBookSourcesHandler } from '@/controllers/bookController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicSourceRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) },
    listBookSourcesHandler,
  );
}

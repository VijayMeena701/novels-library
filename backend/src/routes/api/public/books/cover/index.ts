import { FastifyInstance } from 'fastify';
import { getPublicBookCoverHandler } from '@/controllers/coverController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicBookCoverRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/:token',
    { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) },
    getPublicBookCoverHandler,
  );
}

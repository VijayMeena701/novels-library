import { FastifyInstance } from 'fastify';
import { getBookReviewsHandler } from '@/controllers/bookController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicBookReviewRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) },
    getBookReviewsHandler,
  );
}

import { FastifyInstance } from 'fastify';
import { getCatalogBookHandler } from '@/controllers/novelController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicBookDetailRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) },
    getCatalogBookHandler,
  );
}

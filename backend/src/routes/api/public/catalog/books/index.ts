import { FastifyInstance } from 'fastify';
import { listCatalogBooksHandler } from '@/controllers/bookController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicCatalogBookRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true }) },
    listCatalogBooksHandler,
  );
}

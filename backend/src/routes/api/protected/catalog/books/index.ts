import { FastifyInstance } from 'fastify';
import { listCatalogBooksHandler } from '@/controllers/bookController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedCatalogBookDetailRoutes } from './detail';

export async function protectedCatalogBookRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.BOOKS_LIST) }, listCatalogBooksHandler);

  fastify.register(protectedCatalogBookDetailRoutes, { prefix: '/:id' });
}

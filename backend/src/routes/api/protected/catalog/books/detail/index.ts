import { FastifyInstance } from 'fastify';
import {
  updateCatalogBookHandler,
  deleteCatalogBookHandler,
} from '@/controllers/bookController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedCatalogBookDetailRoutes(fastify: FastifyInstance) {
  fastify.put(
    '/',
    { preHandler: requireCapability(CAPABILITY.BOOKS_UPDATE) },
    updateCatalogBookHandler,
  );
  fastify.delete(
    '/',
    { preHandler: requireCapability(CAPABILITY.BOOKS_DELETE) },
    deleteCatalogBookHandler,
  );
}

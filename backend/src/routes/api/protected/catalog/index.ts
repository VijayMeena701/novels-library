import { FastifyInstance } from 'fastify';
import { protectedCatalogBookRoutes } from './books';

export async function protectedCatalogRoutes(fastify: FastifyInstance) {
  fastify.register(protectedCatalogBookRoutes, { prefix: '/books' });
}

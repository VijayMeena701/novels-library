import { FastifyInstance } from 'fastify';
import { publicCatalogBookRoutes } from './books';

export async function publicCatalogRoutes(fastify: FastifyInstance) {
  fastify.register(publicCatalogBookRoutes, { prefix: '/books' });
}

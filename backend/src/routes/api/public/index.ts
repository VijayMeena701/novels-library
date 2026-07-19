import { FastifyInstance } from 'fastify';
import { publicBookRoutes } from './books';
import { publicCatalogRoutes } from './catalog';
import { publicSourceRoutes } from './sources';
import { publicAuthorRoutes } from './authors';
import { publicGenreRoutes } from './genres';
import { publicPublicationStatusRoutes } from './publication-statuses';

export async function publicRoutes(fastify: FastifyInstance) {
  fastify.register(publicBookRoutes, { prefix: '/books' });
  fastify.register(publicCatalogRoutes, { prefix: '/catalog' });
  fastify.register(publicSourceRoutes, { prefix: '/sources' });
  fastify.register(publicAuthorRoutes, { prefix: '/authors' });
  fastify.register(publicGenreRoutes, { prefix: '/genres' });
  fastify.register(publicPublicationStatusRoutes, { prefix: '/publication-statuses' });
}

import { FastifyInstance } from 'fastify';
import { listGenresHandler } from '@/controllers/taxonomyController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { publicGenreDetailRoutes } from './detail';

export async function publicGenreRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.GENRES_READ, { allowAnonymous: true }) },
    listGenresHandler,
  );

  fastify.register(publicGenreDetailRoutes, { prefix: '/:keyOrId' });
}

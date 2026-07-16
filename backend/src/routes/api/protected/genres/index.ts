import { FastifyInstance } from 'fastify';
import {
  listGenresHandler,
  upsertGenreHandler,
  getGenreHandler,
} from '@/controllers/taxonomyController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedGenreRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.GENRES_READ) }, listGenresHandler);
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.GENRES_MANAGE) }, upsertGenreHandler);
  fastify.get(
    '/:keyOrId',
    { preHandler: requireCapability(CAPABILITY.GENRES_READ) },
    getGenreHandler,
  );
  fastify.put(
    '/:id',
    { preHandler: requireCapability(CAPABILITY.GENRES_MANAGE) },
    upsertGenreHandler,
  );
}

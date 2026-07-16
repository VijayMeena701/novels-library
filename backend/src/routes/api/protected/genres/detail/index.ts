import { FastifyInstance } from 'fastify';
import { getGenreHandler, upsertGenreHandler } from '@/controllers/taxonomyController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedGenreDetailRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.GENRES_READ) }, getGenreHandler);
  fastify.put('/', { preHandler: requireCapability(CAPABILITY.GENRES_MANAGE) }, upsertGenreHandler);
}

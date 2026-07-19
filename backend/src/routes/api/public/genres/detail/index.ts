import { FastifyInstance } from 'fastify';
import { getGenreHandler } from '@/controllers/taxonomyController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicGenreDetailRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.GENRES_READ, { allowAnonymous: true }) },
    getGenreHandler,
  );
}

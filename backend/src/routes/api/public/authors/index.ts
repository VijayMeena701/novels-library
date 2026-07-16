import { FastifyInstance } from 'fastify';
import { listAuthorsHandler } from '@/controllers/authorController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { publicAuthorDetailRoutes } from './detail';

export async function publicAuthorRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.AUTHORS_READ, { allowAnonymous: true }) },
    listAuthorsHandler,
  );

  fastify.register(publicAuthorDetailRoutes, { prefix: '/:id' });
}

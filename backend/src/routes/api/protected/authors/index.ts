import { FastifyInstance } from 'fastify';
import { listAuthorsHandler, upsertAuthorHandler } from '@/controllers/authorController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedAuthorDetailRoutes } from './detail';

export async function protectedAuthorRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.AUTHORS_READ) }, listAuthorsHandler);
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.AUTHORS_MANAGE) }, upsertAuthorHandler);

  fastify.register(protectedAuthorDetailRoutes, { prefix: '/:id' });
}

import { FastifyInstance } from 'fastify';
import { getAuthorHandler, upsertAuthorHandler } from '@/controllers/authorController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedAuthorDetailRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.AUTHORS_READ) }, getAuthorHandler);
  fastify.put('/', { preHandler: requireCapability(CAPABILITY.AUTHORS_MANAGE) }, upsertAuthorHandler);
}

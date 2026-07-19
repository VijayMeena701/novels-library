import { FastifyInstance } from 'fastify';
import { getAuthorHandler } from '@/controllers/authorController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicAuthorDetailRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.AUTHORS_READ, { allowAnonymous: true }) },
    getAuthorHandler,
  );
}

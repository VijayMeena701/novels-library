import { FastifyInstance } from 'fastify';
import { syncBookCoverHandler } from '@/controllers/coverController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookCoverRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/sync',
    { preHandler: requireCapability(CAPABILITY.COVER_SYNC) },
    syncBookCoverHandler,
  );
}

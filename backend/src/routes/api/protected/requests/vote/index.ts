import { FastifyInstance } from 'fastify';
import { voteBookRequestHandler } from '@/controllers/requestController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedRequestVoteRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) },
    voteBookRequestHandler,
  );
}

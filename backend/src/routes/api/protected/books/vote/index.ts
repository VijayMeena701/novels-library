import { FastifyInstance } from 'fastify';
import { voteBookHandler } from '@/controllers/bookController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookVoteRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) },
    voteBookHandler,
  );
}

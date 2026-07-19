import { FastifyInstance } from 'fastify';
import { updateReadingSessionHandler } from '@/controllers/bookController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookReadingSessionDetailRoutes(fastify: FastifyInstance) {
  fastify.put(
    '/',
    { preHandler: requireCapability(CAPABILITY.SESSIONS_MANAGE) },
    updateReadingSessionHandler,
  );
}

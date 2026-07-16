import { FastifyInstance } from 'fastify';
import {
  listReadingSessionsHandler,
  startReadingSessionHandler,
} from '@/controllers/novelController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedBookReadingSessionDetailRoutes } from './sessions';

export async function protectedBookReadingSessionRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.SESSIONS_READ) }, listReadingSessionsHandler);
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.SESSIONS_MANAGE) }, startReadingSessionHandler);

  fastify.register(protectedBookReadingSessionDetailRoutes, { prefix: '/:sessionId' });
}

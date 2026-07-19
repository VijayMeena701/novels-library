import { FastifyInstance } from 'fastify';
import {
  createBookRequestHandler,
  listBookRequestsHandler,
} from '@/controllers/requestController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedRequestVoteRoutes } from './vote';

export async function protectedRequestRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, listBookRequestsHandler);
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, createBookRequestHandler);

  fastify.register(protectedRequestVoteRoutes, { prefix: '/:id/vote' });
}

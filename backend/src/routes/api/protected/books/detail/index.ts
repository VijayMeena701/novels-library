import { FastifyInstance } from 'fastify';
import {
  getBookHandler,
  updateBookHandler,
  deleteBookHandler,
} from '@/controllers/novelController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookDetailRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, getBookHandler);
  fastify.put('/', { preHandler: requireCapability(CAPABILITY.LIBRARY_UPDATE) }, updateBookHandler);
  fastify.delete('/', { preHandler: requireCapability(CAPABILITY.LIBRARY_DELETE) }, deleteBookHandler);
}

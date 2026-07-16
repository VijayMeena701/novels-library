import { FastifyInstance } from 'fastify';
import { addBookToLibraryHandler } from '@/controllers/novelController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookLibraryRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.LIBRARY_ADD) },
    addBookToLibraryHandler,
  );
}

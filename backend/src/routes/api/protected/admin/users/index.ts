import { FastifyInstance } from 'fastify';
import { listUsersHandler, createAdminUserHandler } from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedAdminUserDetailRoutes } from './detail';

export async function protectedAdminUserRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listUsersHandler);
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, createAdminUserHandler);

  fastify.register(protectedAdminUserDetailRoutes, { prefix: '/:id' });
}

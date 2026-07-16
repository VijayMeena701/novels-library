import { FastifyInstance } from 'fastify';
import { listUsersHandler } from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedAdminUserDetailRoutes } from './detail';

export async function protectedAdminUserRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listUsersHandler);

  fastify.register(protectedAdminUserDetailRoutes, { prefix: '/:id' });
}

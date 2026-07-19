import { FastifyInstance } from 'fastify';
import { listResourcesHandler } from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedAdminResourceEnableRoutes } from './enable';

export async function protectedAdminResourceRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listResourcesHandler);

  fastify.register(protectedAdminResourceEnableRoutes, { prefix: '/:id/enable' });
}

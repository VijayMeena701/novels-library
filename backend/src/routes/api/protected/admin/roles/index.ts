import { FastifyInstance } from 'fastify';
import {
  listRolesHandler,
  createRoleHandler,
} from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedAdminRoleDetailRoutes } from './detail';

export async function protectedAdminRoleRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listRolesHandler);
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, createRoleHandler);

  fastify.register(protectedAdminRoleDetailRoutes, { prefix: '/:id' });
}

import { FastifyInstance } from 'fastify';
import {
  updateRoleHandler,
  deleteRoleHandler,
} from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedAdminRoleDetailRoutes(fastify: FastifyInstance) {
  fastify.put('/', { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, updateRoleHandler);
  fastify.delete('/', { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, deleteRoleHandler);
}

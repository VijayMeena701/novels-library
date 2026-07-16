import { FastifyInstance } from 'fastify';
import {
  updateGroupHandler,
  deleteGroupHandler,
} from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedAdminGroupDetailRoutes(fastify: FastifyInstance) {
  fastify.put('/', { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, updateGroupHandler);
  fastify.delete('/', { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, deleteGroupHandler);
}

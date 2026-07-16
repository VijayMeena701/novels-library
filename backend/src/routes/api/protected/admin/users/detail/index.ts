import { FastifyInstance } from 'fastify';
import {
  getUserByIdHandler,
  updateUserHandler,
  deleteUserHandler,
} from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedAdminUserDetailRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, getUserByIdHandler);
  fastify.put('/', { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, updateUserHandler);
  fastify.delete('/', { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, deleteUserHandler);
}

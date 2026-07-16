import { FastifyInstance } from 'fastify';
import {
  listGroupsHandler,
  createGroupHandler,
} from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedAdminGroupDetailRoutes } from './detail';

export async function protectedAdminGroupRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listGroupsHandler);
  fastify.post('/', { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) }, createGroupHandler);

  fastify.register(protectedAdminGroupDetailRoutes, { prefix: '/:id' });
}

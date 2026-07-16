import { FastifyInstance } from 'fastify';
import { getAdminStatsHandler } from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedAdminUserRoutes } from './users';
import { protectedAdminRoleRoutes } from './roles';
import { protectedAdminGroupRoutes } from './groups';
import { protectedAdminResourceRoutes } from './resources';
import { protectedAdminAuditLogRoutes } from './audit-logs';

export async function protectedAdminRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, getAdminStatsHandler);

  fastify.register(protectedAdminUserRoutes, { prefix: '/users' });
  fastify.register(protectedAdminRoleRoutes, { prefix: '/roles' });
  fastify.register(protectedAdminGroupRoutes, { prefix: '/groups' });
  fastify.register(protectedAdminResourceRoutes, { prefix: '/resources' });
  fastify.register(protectedAdminAuditLogRoutes, { prefix: '/audit-logs' });
}

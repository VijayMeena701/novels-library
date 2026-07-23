import { FastifyInstance } from 'fastify';
import { getAdminStatsHandler, listCapabilitiesHandler } from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedAdminUserRoutes } from './users';
import { protectedAdminRoleRoutes } from './roles';
import { protectedAdminGroupRoutes } from './groups';
import { protectedAdminResourceRoutes } from './resources';
import { protectedAdminAuditLogRoutes } from './audit-logs';
import { protectedAdminAppConfigRoutes } from './app-config';

export async function protectedAdminRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, getAdminStatsHandler);
  fastify.get('/capabilities', { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listCapabilitiesHandler);

  fastify.register(protectedAdminUserRoutes, { prefix: '/users' });
  fastify.register(protectedAdminRoleRoutes, { prefix: '/roles' });
  fastify.register(protectedAdminGroupRoutes, { prefix: '/groups' });
  fastify.register(protectedAdminResourceRoutes, { prefix: '/resources' });
  fastify.register(protectedAdminAuditLogRoutes, { prefix: '/audit-logs' });
  fastify.register(protectedAdminAppConfigRoutes, { prefix: '/app-config' });
}

import { FastifyInstance } from 'fastify';
import { listAuditLogsHandler } from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedAdminAuditLogRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.ADMIN_ACCESS) }, listAuditLogsHandler);
}

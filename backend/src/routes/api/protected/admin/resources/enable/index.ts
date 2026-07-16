import { FastifyInstance } from 'fastify';
import { enableResourceHandler } from '@/controllers/adminController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedAdminResourceEnableRoutes(fastify: FastifyInstance) {
  fastify.put(
    '/',
    { preHandler: requireCapability(CAPABILITY.ADMIN_MANAGE) },
    enableResourceHandler,
  );
}

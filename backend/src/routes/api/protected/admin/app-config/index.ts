import { FastifyInstance } from 'fastify';
import { listAppConfigsHandler, updateAppConfigHandler } from '@/controllers/appConfigController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedAdminAppConfigRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.APP_CONFIG_READ) }, listAppConfigsHandler);
  fastify.put(
    '/:name',
    { preHandler: requireCapability(CAPABILITY.APP_CONFIG_UPDATE) },
    updateAppConfigHandler,
  );
}

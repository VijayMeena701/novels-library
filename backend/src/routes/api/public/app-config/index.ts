import { FastifyInstance } from 'fastify';
import { getAppConfigByNameHandler } from '@/controllers/appConfigController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicAppConfigRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/:name',
    { preHandler: requireCapability(CAPABILITY.APP_CONFIG_READ, { allowAnonymous: true }) },
    getAppConfigByNameHandler,
  );
}

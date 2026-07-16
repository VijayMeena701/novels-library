import { FastifyInstance } from 'fastify';
import { getUserSettingsHandler, updateUserSettingsHandler } from '@/controllers/settingsController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedSettingsRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.SETTINGS_READ) }, getUserSettingsHandler);
  fastify.put('/', { preHandler: requireCapability(CAPABILITY.SETTINGS_UPDATE) }, updateUserSettingsHandler);
}

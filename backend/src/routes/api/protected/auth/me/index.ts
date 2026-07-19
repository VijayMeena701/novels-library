import { FastifyInstance } from 'fastify';
import { meHandler, updateMeHandler } from '@/controllers/authController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedMeRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.PROFILE_READ) }, meHandler);
  fastify.put('/', { preHandler: requireCapability(CAPABILITY.PROFILE_UPDATE) }, updateMeHandler);
}

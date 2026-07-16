import { FastifyInstance } from 'fastify';
import { getCapabilitiesHandler } from '@/controllers/authController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedCapabilitiesRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.PROFILE_READ) }, getCapabilitiesHandler);
}

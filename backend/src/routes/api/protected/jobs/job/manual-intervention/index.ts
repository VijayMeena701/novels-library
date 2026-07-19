import { FastifyInstance } from 'fastify';
import { openManualInterventionHandler } from '@/controllers/jobController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedJobManualInterventionRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.JOBS_MANUAL_INTERVENTION) },
    openManualInterventionHandler,
  );
}

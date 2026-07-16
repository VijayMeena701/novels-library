import { FastifyInstance } from 'fastify';
import { markNotificationReadHandler } from '@/controllers/notificationController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedNotificationReadRoutes(fastify: FastifyInstance) {
  fastify.put(
    '/',
    { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) },
    markNotificationReadHandler,
  );
}

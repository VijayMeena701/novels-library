import { FastifyInstance } from 'fastify';
import { markAllNotificationsReadHandler } from '@/controllers/notificationController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedNotificationReadAllRoutes(fastify: FastifyInstance) {
  fastify.put(
    '/',
    { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) },
    markAllNotificationsReadHandler,
  );
}

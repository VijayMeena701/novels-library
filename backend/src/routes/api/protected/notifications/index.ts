import { FastifyInstance } from 'fastify';
import { getNotificationsHandler } from '@/controllers/notificationController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { protectedNotificationReadRoutes } from './read';
import { protectedNotificationReadAllRoutes } from './read-all';

export async function protectedNotificationsRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.LIBRARY_READ) }, getNotificationsHandler);

  fastify.register(protectedNotificationReadRoutes, { prefix: '/:id/read' });
  fastify.register(protectedNotificationReadAllRoutes, { prefix: '/read-all' });
}

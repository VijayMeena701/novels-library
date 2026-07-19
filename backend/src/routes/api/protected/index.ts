import { FastifyInstance } from 'fastify';
import { authenticateHook } from '../../authenticateHook';
import { protectedAuthRoutes } from './auth';
import { protectedSettingsRoutes } from './settings';
import { protectedHistoryRoutes } from './history';
import { protectedNotificationsRoutes } from './notifications';
import { protectedBookRoutes } from './books';
import { protectedReportRoutes } from './reports';
import { protectedRequestRoutes } from './requests';
import { protectedCatalogRoutes } from './catalog';
import { protectedAuthorRoutes } from './authors';
import { protectedGenreRoutes } from './genres';
import { protectedPublicationStatusRoutes } from './publication-statuses';
import { protectedPronunciationRuleRoutes } from './pronunciation-rules';
import { protectedJobRoutes } from './jobs';
import { protectedAdminRoutes } from './admin';

export async function protectedRoutes(fastify: FastifyInstance) {
  fastify.addHook('preValidation', authenticateHook);

  fastify.register(protectedAuthRoutes, { prefix: '/auth' });
  fastify.register(protectedSettingsRoutes, { prefix: '/settings' });
  fastify.register(protectedHistoryRoutes, { prefix: '/history' });
  fastify.register(protectedNotificationsRoutes, { prefix: '/notifications' });
  fastify.register(protectedBookRoutes, { prefix: '/books' });
  fastify.register(protectedReportRoutes, { prefix: '/reports' });
  fastify.register(protectedRequestRoutes, { prefix: '/requests' });
  fastify.register(protectedCatalogRoutes, { prefix: '/catalog' });
  fastify.register(protectedAuthorRoutes, { prefix: '/authors' });
  fastify.register(protectedGenreRoutes, { prefix: '/genres' });
  fastify.register(protectedPublicationStatusRoutes, { prefix: '/publication-statuses' });
  fastify.register(protectedPronunciationRuleRoutes, { prefix: '/pronunciation-rules' });
  fastify.register(protectedJobRoutes, { prefix: '/jobs' });
  fastify.register(protectedAdminRoutes, { prefix: '/admin' });
}

import { FastifyInstance } from 'fastify';
import { onResponseAuditLog } from '@/services/rbac';
import { publicRoutes } from './public';
import { publicAuthRoutes } from './auth';
import { homeRoutes } from './home';
import { protectedRoutes } from './protected';

export async function apiRoutes(fastify: FastifyInstance) {
  fastify.addHook('onResponse', onResponseAuditLog);

  fastify.register(publicRoutes, { prefix: '/public' });
  fastify.register(publicAuthRoutes, { prefix: '/auth' });
  fastify.register(homeRoutes, { prefix: '/home' });
  fastify.register(protectedRoutes);
}

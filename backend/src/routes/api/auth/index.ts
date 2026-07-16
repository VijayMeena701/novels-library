import { FastifyInstance } from 'fastify';
import { publicRegisterRoutes } from './register';
import { publicLoginRoutes } from './login';
import { publicGoogleAuthRoutes } from './google';

export async function publicAuthRoutes(fastify: FastifyInstance) {
  fastify.register(publicRegisterRoutes, { prefix: '/register' });
  fastify.register(publicLoginRoutes, { prefix: '/login' });
  fastify.register(publicGoogleAuthRoutes, { prefix: '/google' });
}

import { FastifyInstance } from 'fastify';
import { protectedMeRoutes } from './me';
import { protectedCapabilitiesRoutes } from './capabilities';

export async function protectedAuthRoutes(fastify: FastifyInstance) {
  fastify.register(protectedMeRoutes, { prefix: '/me' });
  fastify.register(protectedCapabilitiesRoutes, { prefix: '/capabilities' });
}

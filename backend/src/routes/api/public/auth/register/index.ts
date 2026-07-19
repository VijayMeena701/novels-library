import { FastifyInstance } from 'fastify';
import { registerHandler } from '@/controllers/authController';

export async function publicRegisterRoutes(fastify: FastifyInstance) {
  fastify.post('/', registerHandler);
}

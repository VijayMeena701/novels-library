import { FastifyInstance } from 'fastify';
import { loginHandler } from '@/controllers/authController';

export async function publicLoginRoutes(fastify: FastifyInstance) {
  fastify.post('/', loginHandler);
}

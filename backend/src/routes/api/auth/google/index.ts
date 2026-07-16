import { FastifyInstance } from 'fastify';
import {
  googleLoginHandler,
  googleCallbackHandler,
} from '@/controllers/authController';

export async function publicGoogleAuthRoutes(fastify: FastifyInstance) {
  fastify.get('/', googleLoginHandler);
  fastify.get('/callback', googleCallbackHandler);
}

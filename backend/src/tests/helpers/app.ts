import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { apiRoutes } from '@/routes/api.js';

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'test-jwt-secret' });
  await app.register(apiRoutes, { prefix: '/api' });
  await app.ready();
  return app;
}

import supertest from 'supertest';
import { buildApp } from './app.js';

export async function getToken({ email, password }: { email: string; password: string }) {
  const app = await buildApp();
  const res = await supertest(app.server).post('/api/auth/login').send({ email, password });
  return res.body.token as string;
}

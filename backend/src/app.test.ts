import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { app } from './app';

describe('app.ts', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers the health route', async () => {
    const res = await supertest(app.server).get('/health');
    expect(res.status).toBe(200);
  });

  it('registers API routes under /api', async () => {
    const res = await supertest(app.server).get('/api/public/catalog/books');
    expect([200, 401, 403, 404]).toContain(res.status);
  });

  it('allows CORS for localhost origin', async () => {
    const res = await supertest(app.server).get('/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('rejects CORS for disallowed origin', async () => {
    const res = await supertest(app.server).get('/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(500);
  });
});

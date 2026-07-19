import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { createUser } from '../../fixtures/users.js';

const TEST_PASSWORD = 'password123';

describe('POST /api/auth/register', () => {
  it('creates a user and returns a token', async () => {
    const app = await buildApp();
    const res = await supertest(app.server)
      .post('/api/auth/register')
      .send({ username: 'tester', email: 'test@example.com', password: TEST_PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('returns 400 when fields are missing', async () => {
    const app = await buildApp();
    const res = await supertest(app.server).post('/api/auth/register').send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for valid credentials', async () => {
    const app = await buildApp();
    await createUser({ email: 'login@example.com', password: TEST_PASSWORD });
    const res = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 for invalid credentials', async () => {
    const app = await buildApp();
    await createUser({ email: 'bad@example.com', password: TEST_PASSWORD });
    const res = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'bad@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const app = await buildApp();
    await createUser({ email: 'me@example.com', password: TEST_PASSWORD });
    const loginRes = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'me@example.com', password: TEST_PASSWORD });
    const res = await supertest(app.server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
  });

  it('returns 401 without a token', async () => {
    const app = await buildApp();
    const res = await supertest(app.server).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

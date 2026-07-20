import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { createUser } from '../../fixtures/users.js';

const TEST_PASSWORD = 'password123';

describe('Settings routes', () => {
  it('GET /api/settings returns default settings for an authenticated user', async () => {
    const app = await buildApp();
    await createUser({ email: 'settings@example.com', password: TEST_PASSWORD });
    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'settings@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .get('/api/settings')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBeDefined();
    expect(res.body.reader).toBeDefined();
    expect(res.body.reader.theme).toBeDefined();
  });

  it('PUT /api/settings updates reader settings', async () => {
    const app = await buildApp();
    await createUser({ email: 'settings2@example.com', password: TEST_PASSWORD });
    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'settings2@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .put('/api/settings')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ reader: { theme: 'night', fontSize: 24, width: 'wide' } });

    expect(res.status).toBe(200);
    expect(res.body.reader.theme).toBe('night');
    expect(res.body.reader.fontSize).toBe(24);
    expect(res.body.reader.width).toBe('wide');
  });

  it('ignores invalid reader settings values', async () => {
    const app = await buildApp();
    await createUser({ email: 'settings3@example.com', password: TEST_PASSWORD });
    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'settings3@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .put('/api/settings')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ reader: { theme: 'invalid', fontSize: 5 } });

    expect(res.status).toBe(200);
    expect(res.body.reader.theme).not.toBe('invalid');
    expect(res.body.reader.fontSize).not.toBe(5);
  });

  it('returns 401 without a token', async () => {
    const app = await buildApp();
    const res = await supertest(app.server).get('/api/settings');
    expect(res.status).toBe(401);
  });
});

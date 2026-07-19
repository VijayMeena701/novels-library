import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { createUser } from '../../fixtures/users.js';
import { createSampleBook } from '../../fixtures/books.js';

const TEST_PASSWORD = 'password123';

describe('GET /api/public/books/:id/cover/:token', () => {
  it('returns 400 for an invalid book id', async () => {
    const app = await buildApp();
    const res = await supertest(app.server).get('/api/public/books/invalid/cover/token');
    expect(res.status).toBe(400);
  });

  it('returns 404 when the cover image is missing', async () => {
    const app = await buildApp();
    const book = await createSampleBook({ title: 'No Cover Book' });
    const res = await supertest(app.server).get(`/api/public/books/${book._id}/cover/missing-token`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/books/:id/cover/sync', () => {
  it('returns 400 for an invalid book id when authenticated as admin', async () => {
    const app = await buildApp();
    await createUser({ email: 'admin@example.com', password: TEST_PASSWORD, roleKey: 'superadmin' });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .post('/api/books/invalid/cover/sync')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 for a non-admin user', async () => {
    const app = await buildApp();
    await createUser({ email: 'reader@example.com', password: TEST_PASSWORD });
    const book = await createSampleBook({ title: 'Cover Book' });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'reader@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .post(`/api/books/${book._id}/cover/sync`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({});

    expect(res.status).toBe(403);
  });
});

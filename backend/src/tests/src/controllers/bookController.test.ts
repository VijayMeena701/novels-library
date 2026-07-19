import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { createUser } from '../../fixtures/users.js';
import { createSampleBook } from '../../fixtures/books.js';

const TEST_PASSWORD = 'password123';

describe('Public catalog routes', () => {
  it('GET /api/public/catalog/books returns books for anonymous users', async () => {
    const app = await buildApp();
    await createSampleBook({ title: 'Public Book' });
    const res = await supertest(app.server).get('/api/public/catalog/books');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].title).toBe('Public Book');
  });

  it('GET /api/public/books/:id returns a single book', async () => {
    const app = await buildApp();
    const book = await createSampleBook({ title: 'Catalog Book' });
    const res = await supertest(app.server).get(`/api/public/books/${book._id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Catalog Book');
  });
});

describe('Protected book routes', () => {
  it('POST /api/books creates a catalog book when user has admin capability', async () => {
    const app = await buildApp();
    await createUser({ email: 'admin@example.com', password: TEST_PASSWORD, roleKey: 'superadmin' });
    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .post('/api/books')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ title: 'New Catalog Book' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Catalog Book');
  });

  it('POST /api/books/:id/library adds a book to the user library', async () => {
    const app = await buildApp();
    const book = await createSampleBook({ title: 'Library Book' });
    await createUser({ email: 'reader@example.com', password: TEST_PASSWORD });
    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'reader@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .post(`/api/books/${book._id}/library`)
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Library Book');
  });

  it('GET /api/books/:id returns a book from the user library', async () => {
    const app = await buildApp();
    const book = await createSampleBook({ title: 'My Book' });
    await createUser({ email: 'reader@example.com', password: TEST_PASSWORD });
    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'reader@example.com', password: TEST_PASSWORD });

    await supertest(app.server)
      .post(`/api/books/${book._id}/library`)
      .set('Authorization', `Bearer ${login.body.token}`);

    const res = await supertest(app.server)
      .get(`/api/books/${book._id}`)
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('My Book');
  });
});

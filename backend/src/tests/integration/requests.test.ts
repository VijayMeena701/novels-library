import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../helpers/app.js';
import { createUser } from '../fixtures/users.js';
import { BookRequest } from '@/models/BookRequest.js';

const TEST_PASSWORD = 'password123';

describe('Book request routes', () => {
  it('GET /api/requests lists book requests', async () => {
    const app = await buildApp();
    const user = await createUser({ email: 'requests@example.com', password: TEST_PASSWORD });
    await BookRequest.create({
      title: 'Missing Book',
      description: 'Please add this book',
      requestedByUserId: user._id,
      status: 'open',
      votes: 0,
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'requests@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server).get('/api/requests').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.requests.length).toBeGreaterThanOrEqual(1);
  }, 10000);

  it('POST /api/requests creates a new book request', async () => {
    const app = await buildApp();
    await createUser({ email: 'creator@example.com', password: TEST_PASSWORD });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'creator@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .post('/api/requests')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ title: 'New Book Request', description: 'Details' });

    expect(res.status).toBe(201);
    expect(res.body.request.title).toBe('New Book Request');
  }, 10000);

  it('POST /api/requests/:id/vote increments vote count', async () => {
    const app = await buildApp();
    const user = await createUser({ email: 'voter@example.com', password: TEST_PASSWORD });
    const requestDoc = await BookRequest.create({
      title: 'Vote Book',
      description: '',
      requestedByUserId: user._id,
      status: 'open',
      votes: 0,
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'voter@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .post(`/api/requests/${requestDoc._id}/vote`)
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.request.votes).toBe(1);
  }, 10000);
});

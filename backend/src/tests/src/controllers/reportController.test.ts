import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { createUser } from '../../fixtures/users.js';
import { createSampleBook } from '../../fixtures/books.js';
import { Report } from '@/models/Report.js';

const TEST_PASSWORD = 'password123';

describe('Report routes', () => {
  it('POST /api/books/:id/report creates a report for an authenticated user', async () => {
    const app = await buildApp();
    await createUser({ email: 'reporter@example.com', password: TEST_PASSWORD });
    const book = await createSampleBook({ title: 'Reportable Book' });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'reporter@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .post(`/api/books/${book._id}/report`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ reason: 'spam', description: 'Test report' });

    expect(res.status).toBe(201);
    expect(res.body.report.reason).toBe('spam');
    expect(res.body.report.bookId.toString()).toBe(book._id.toString());
  });

  it('returns 400 for invalid report reason', async () => {
    const app = await buildApp();
    await createUser({ email: 'badreporter@example.com', password: TEST_PASSWORD });
    const book = await createSampleBook({ title: 'Book' });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'badreporter@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .post(`/api/books/${book._id}/report`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ reason: 'not_valid' });

    expect(res.status).toBe(400);
  });

  it('GET /api/reports lists reports for admins', async () => {
    const app = await buildApp();
    const admin = await createUser({ email: 'admin@example.com', password: TEST_PASSWORD, roleKey: 'superadmin' });
    const book = await createSampleBook({ title: 'Reported Book' });
    await Report.create({
      bookId: book._id,
      reporterUserId: admin._id,
      reason: 'other',
      description: 'Report text',
      status: 'open',
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server).get('/api/reports').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.reports.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('PUT /api/reports/:id/status updates report status', async () => {
    const app = await buildApp();
    const admin = await createUser({ email: 'admin2@example.com', password: TEST_PASSWORD, roleKey: 'superadmin' });
    const book = await createSampleBook({ title: 'Status Book' });
    const report = await Report.create({
      bookId: book._id,
      reporterUserId: admin._id,
      reason: 'spam',
      description: '',
      status: 'open',
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'admin2@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .put(`/api/reports/${report._id}/status`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('resolved');
  });
});

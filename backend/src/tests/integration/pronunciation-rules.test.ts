import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../helpers/app.js';
import { createUser } from '../fixtures/users.js';
import { createSampleBook } from '../fixtures/books.js';
import { PronunciationRule } from '@/models/PronunciationRule.js';

const TEST_PASSWORD = 'password123';

describe('Pronunciation rule routes', () => {
  it('GET /api/books/:id/pronunciation-rules lists rules for a book', async () => {
    const app = await buildApp();
    const user = await createUser({ email: 'pronounce@example.com', password: TEST_PASSWORD, roleKey: 'superadmin' });
    const book = await createSampleBook({ title: 'Pronounce Book' });
    await PronunciationRule.create({
      userId: user._id,
      bookId: book._id,
      pattern: 'Xiu',
      replacement: 'Shu',
      isGlobal: false,
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'pronounce@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .get(`/api/books/${book._id}/pronunciation-rules`)
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].pattern).toBe('Xiu');
  }, 10000);

  it('POST /api/books/:id/pronunciation-rules creates a rule', async () => {
    const app = await buildApp();
    const user = await createUser({
      email: 'pronounceadmin@example.com',
      password: TEST_PASSWORD,
      roleKey: 'superadmin',
    });
    const book = await createSampleBook({ title: 'Rule Book' });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'pronounceadmin@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .post(`/api/books/${book._id}/pronunciation-rules`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ pattern: 'abc', replacement: 'xyz' });

    expect(res.status).toBe(201);
    expect(res.body.pattern).toBe('abc');
    expect(res.body.replacement).toBe('xyz');
  }, 10000);

  it('PUT /api/pronunciation-rules/:ruleId updates a rule', async () => {
    const app = await buildApp();
    const user = await createUser({ email: 'ruleeditor@example.com', password: TEST_PASSWORD, roleKey: 'superadmin' });
    const book = await createSampleBook({ title: 'Edit Book' });
    const rule = await PronunciationRule.create({
      userId: user._id,
      bookId: book._id,
      pattern: 'old',
      replacement: 'old',
      isGlobal: false,
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'ruleeditor@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .put(`/api/pronunciation-rules/${rule._id}`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ pattern: 'new', replacement: 'new' });

    expect(res.status).toBe(200);
    expect(res.body.pattern).toBe('new');
  }, 10000);

  it('DELETE /api/pronunciation-rules/:ruleId deletes a rule', async () => {
    const app = await buildApp();
    const user = await createUser({ email: 'ruledeleter@example.com', password: TEST_PASSWORD, roleKey: 'superadmin' });
    const book = await createSampleBook({ title: 'Delete Book' });
    const rule = await PronunciationRule.create({
      userId: user._id,
      bookId: book._id,
      pattern: 'delete',
      replacement: '',
      isGlobal: false,
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'ruledeleter@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .delete(`/api/pronunciation-rules/${rule._id}`)
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  }, 10000);
});

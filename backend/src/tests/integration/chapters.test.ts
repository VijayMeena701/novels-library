import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../helpers/app.js';
import { createUser } from '../fixtures/users.js';
import { createSampleBook, createSampleChapter } from '../fixtures/books.js';

const TEST_PASSWORD = 'password123';

describe('Chapter routes', () => {
  it('GET /api/books/:id/chapters lists chapters for a book in the library', async () => {
    const app = await buildApp();
    const book = await createSampleBook({ title: 'Chapter Book' });
    await createSampleChapter(book._id.toString(), 1, 'Chapter One');
    await createSampleChapter(book._id.toString(), 2, 'Chapter Two');

    await createUser({ email: 'reader@example.com', password: TEST_PASSWORD });
    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'reader@example.com', password: TEST_PASSWORD });

    await supertest(app.server)
      .post(`/api/books/${book._id}/library`)
      .set('Authorization', `Bearer ${login.body.token}`);

    const res = await supertest(app.server)
      .get(`/api/books/${book._id}/chapters`)
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].chapterNumber).toBe(1);
  });

  it('POST /api/books/:id/chapters/:chapterNumber/visits records a chapter visit', async () => {
    const app = await buildApp();
    const book = await createSampleBook({ title: 'Visit Book' });
    await createSampleChapter(book._id.toString(), 1, 'Chapter One');

    await createUser({ email: 'reader@example.com', password: TEST_PASSWORD });
    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'reader@example.com', password: TEST_PASSWORD });

    await supertest(app.server)
      .post(`/api/books/${book._id}/library`)
      .set('Authorization', `Bearer ${login.body.token}`);

    const res = await supertest(app.server)
      .post(`/api/books/${book._id}/chapters/1/visits`)
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(201);
    expect(res.body.chapterNumber).toBe(1);
    expect(res.body.chapterTitle).toBe('Chapter One');
  });

  it('GET /api/public/books/:id/chapters returns chapters for anonymous users', async () => {
    const app = await buildApp();
    const book = await createSampleBook({ title: 'Public Chapter Book' });
    await createSampleChapter(book._id.toString(), 1, 'Public Chapter One');

    const res = await supertest(app.server).get(`/api/public/books/${book._id}/chapters`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Public Chapter One');
  });
});

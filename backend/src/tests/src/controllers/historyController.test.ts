import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { createUser } from '../../fixtures/users.js';
import { createSampleBook } from '../../fixtures/books.js';
import { ChapterVisit } from '@/models/ChapterVisit.js';

const TEST_PASSWORD = 'password123';

describe('GET /api/history', () => {
  it('returns paginated reading history for an authenticated user', async () => {
    const app = await buildApp();
    const user = await createUser({ email: 'history@example.com', password: TEST_PASSWORD });
    const book = await createSampleBook({ title: 'History Book' });

    await ChapterVisit.create({
      userId: user._id,
      bookId: book._id,
      chapterNumber: 1,
      openedAt: new Date(),
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'history@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server).get('/api/history').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.visits.length).toBe(1);
    expect(res.body.pagination.total).toBe(1);
  }, 10000);
});

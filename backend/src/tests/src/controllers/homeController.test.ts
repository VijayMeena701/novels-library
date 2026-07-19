import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { createSampleBook } from '../../fixtures/books.js';

describe('GET /api/home', () => {
  it('returns home data for anonymous users', async () => {
    const app = await buildApp();
    await createSampleBook({ title: 'Home Book' });

    const res = await supertest(app.server).get('/api/home');
    expect(res.status).toBe(200);
    expect(res.body.stats.totalBooks).toBeGreaterThanOrEqual(1);
    expect(res.body.recentlyUpdated[0].title).toBe('Home Book');
  });
});

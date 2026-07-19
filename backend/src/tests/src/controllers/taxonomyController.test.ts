import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { createUser } from '../../fixtures/users.js';
import { Book } from '@/models/Book.js';
import { Genre } from '@/models/Genre.js';
import { PublicationStatus } from '@/models/PublicationStatus.js';
import { Author } from '@/models/Author.js';

const TEST_PASSWORD = 'password123';

async function adminLogin(app: any) {
  await createUser({ email: 'admin@example.com', password: TEST_PASSWORD, roleKey: 'superadmin' });
  const login = await supertest(app.server)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: TEST_PASSWORD });
  return login.body.token as string;
}

describe('Public taxonomy routes', () => {
  it('GET /api/public/genres lists genres with book counts', async () => {
    const app = await buildApp();
    const genre = await Genre.create({ name: 'Fantasy', key: 'fantasy' });
    await Book.create({ title: 'Fantasy Book', genres: [genre.name], genreIds: [genre._id] });

    const res = await supertest(app.server).get('/api/public/genres');
    expect(res.status).toBe(200);
    const found = res.body.find((g: any) => g.key === 'fantasy');
    expect(found).toBeDefined();
    expect(found.bookCount).toBe(1);
  });

  it('GET /api/public/genres/:keyOrId returns a genre with its books', async () => {
    const app = await buildApp();
    const genre = await Genre.create({ name: 'Sci-Fi', key: 'sci-fi' });
    await Book.create({ title: 'Sci-Fi Book', genres: [genre.name], genreIds: [genre._id] });

    const res = await supertest(app.server).get(`/api/public/genres/${genre.key}`);
    expect(res.status).toBe(200);
    expect(res.body.genre.key).toBe('sci-fi');
    expect(res.body.books).toHaveLength(1);
  });

  it('GET /api/public/publication-statuses lists statuses with counts', async () => {
    const app = await buildApp();
    const status = await PublicationStatus.create({ name: 'Ongoing', key: 'ongoing' });
    await Book.create({
      title: 'Ongoing Book',
      publicationStatus: status.name,
      publicationStatusId: status._id,
    });

    const res = await supertest(app.server).get('/api/public/publication-statuses');
    expect(res.status).toBe(200);
    const found = res.body.find((s: any) => s.key === 'ongoing');
    expect(found).toBeDefined();
    expect(found.bookCount).toBe(1);
  });

  it('GET /api/public/publication-statuses/:keyOrId returns a status with its books', async () => {
    const app = await buildApp();
    const status = await PublicationStatus.create({ name: 'Completed', key: 'completed' });
    await Book.create({
      title: 'Completed Book',
      publicationStatus: status.name,
      publicationStatusId: status._id,
    });

    const res = await supertest(app.server).get(`/api/public/publication-statuses/${status.key}`);
    expect(res.status).toBe(200);
    expect(res.body.status.key).toBe('completed');
    expect(res.body.books).toHaveLength(1);
  });

  it('GET /api/public/authors lists authors with counts', async () => {
    const app = await buildApp();
    const author = await Author.create({ displayName: 'Test Author' });
    await Book.create({ title: 'Author Book', author: author.displayName, authorIds: [author._id] });

    const res = await supertest(app.server).get('/api/public/authors');
    expect(res.status).toBe(200);
    const found = res.body.find((a: any) => a.displayName === 'Test Author');
    expect(found).toBeDefined();
    expect(found.bookCount).toBe(1);
  });

  it('GET /api/public/authors/:id returns an author with its books', async () => {
    const app = await buildApp();
    const author = await Author.create({ displayName: 'Detail Author' });
    await Book.create({
      title: 'Detail Book',
      author: author.displayName,
      authorIds: [author._id],
    });

    const res = await supertest(app.server).get(`/api/public/authors/${author._id}`);
    expect(res.status).toBe(200);
    expect(res.body.author.displayName).toBe('Detail Author');
    expect(res.body.books).toHaveLength(1);
  });
});

describe('Protected taxonomy routes', () => {
  it('POST /api/genres creates a genre when user is admin', async () => {
    const app = await buildApp();
    const token = await adminLogin(app);
    const res = await supertest(app.server)
      .post('/api/genres')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Genre' });

    expect(res.status).toBe(201);
    expect(res.body.key).toBe('new-genre');
  });

  it('PUT /api/genres/:id updates a genre when user is admin', async () => {
    const app = await buildApp();
    const token = await adminLogin(app);
    const genre = await Genre.create({ name: 'Old', key: 'old' });

    const res = await supertest(app.server)
      .put(`/api/genres/${genre._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated', aliases: ['Old'] });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('POST /api/genres rejects non-admin users', async () => {
    const app = await buildApp();
    await createUser({ email: 'user@example.com', password: TEST_PASSWORD });
    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .post('/api/genres')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'Hacker Genre' });

    expect(res.status).toBe(403);
  });

  it('POST /api/publication-statuses creates a status when user is admin', async () => {
    const app = await buildApp();
    const token = await adminLogin(app);
    const res = await supertest(app.server)
      .post('/api/publication-statuses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Announced', color: '#000000', sortOrder: 1 });

    expect(res.status).toBe(201);
    expect(res.body.key).toBe('announced');
  });

  it('POST /api/authors creates an author when user is admin', async () => {
    const app = await buildApp();
    const token = await adminLogin(app);
    const res = await supertest(app.server)
      .post('/api/authors')
      .set('Authorization', `Bearer ${token}`)
      .send({ author: 'Jane Doe' });

    expect(res.status).toBe(201);
    expect(res.body.displayName).toBe('Jane Doe');
  });
});

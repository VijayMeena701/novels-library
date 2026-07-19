import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { createUser } from '../../fixtures/users.js';
import { Notification } from '@/models/Notification.js';

const TEST_PASSWORD = 'password123';

describe('Notification routes', () => {
  it('GET /api/notifications returns notifications for an authenticated user', async () => {
    const app = await buildApp();
    const user = await createUser({ email: 'notified@example.com', password: TEST_PASSWORD });
    await Notification.create({
      userId: user._id,
      type: 'system',
      title: 'Hello',
      message: 'Test notification',
      read: false,
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'notified@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(1);
    expect(res.body.unreadCount).toBe(1);
  });

  it('PUT /api/notifications/:id/read marks a notification as read', async () => {
    const app = await buildApp();
    const user = await createUser({ email: 'notifyreader@example.com', password: TEST_PASSWORD });
    const notification = await Notification.create({
      userId: user._id,
      type: 'system',
      title: 'Hello',
      message: 'Read me',
      read: false,
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'notifyreader@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .put(`/api/notifications/${notification._id}/read`)
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.notification.read).toBe(true);
  });

  it('PUT /api/notifications/read-all marks all notifications as read', async () => {
    const app = await buildApp();
    const user = await createUser({ email: 'readall@example.com', password: TEST_PASSWORD });
    await Notification.create({
      userId: user._id,
      type: 'system',
      title: 'A',
      message: 'Message A',
      read: false,
    });

    const login = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'readall@example.com', password: TEST_PASSWORD });

    const res = await supertest(app.server)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

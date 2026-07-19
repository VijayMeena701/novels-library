import { MongoMemoryServer } from 'mongodb-memory-server';
import { beforeAll, afterAll, afterEach } from 'vitest';

process.env.REDIS_ENABLED = 'false';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ADMIN_EMAILS = 'admin@example.com';
  process.env.NODE_ENV = 'test';

  const { connectDB } = await import('@/config/db.js');
  await connectDB();

  const { syncPolicies } = await import('@/services/casbin.js');
  await syncPolicies();
});

afterEach(async () => {
  const mongoose = await import('mongoose');
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  const { disconnectDB } = await import('@/config/db.js');
  await disconnectDB();
  await mongod.stop();
});

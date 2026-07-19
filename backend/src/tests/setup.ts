import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

process.env.REDIS_ENABLED = 'false';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ADMIN_EMAILS = 'admin@example.com';
process.env.NODE_ENV = 'test';

const TEST_DB_NAME = 'test-novels-library';
const mongod = await MongoMemoryServer.create();
const testUri = mongod.getUri(TEST_DB_NAME);
process.env.MONGODB_URI = testUri;

beforeAll(async () => {
  const { connectDB } = await import('@/config/db.js');
  await connectDB();

  const dbName = mongoose.connection.db?.databaseName;
  if (dbName !== TEST_DB_NAME) {
    throw new Error(`Test setup connected to wrong database: ${dbName}`);
  }

  const { syncPolicies } = await import('@/services/casbin.js');
  await syncPolicies();
});

afterEach(async () => {
  const dbName = mongoose.connection.db?.databaseName;
  if (dbName !== TEST_DB_NAME) {
    throw new Error(`Refusing to clear collections on database: ${dbName}`);
  }

  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  const { disconnectDB } = await import('@/config/db.js');
  await disconnectDB();
  await mongod.stop();
});

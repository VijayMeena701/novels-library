/// <reference types="node" />
import process from 'node:process';
import mongoose from 'mongoose';
import { config } from '../src/config/index';
import { seedRbac } from '../src/services/seed';

const MONGODB_URI = config.mongodbUri;

async function main() {
  console.log('Connecting to:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  try {
    await seedRbac();
    await db.collection('migrations').updateOne(
      { name: 'seed-rbac' },
      { $set: { name: 'seed-rbac', completedAt: new Date() } },
      { upsert: true },
    );
    console.log('[Seed] complete.');
  } catch (err: any) {
    console.error('Seed failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();

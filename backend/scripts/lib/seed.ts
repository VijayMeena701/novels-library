import { seedRbac } from '../../src/services/seed.js';
import { log } from './mongodb-tools.js';

export async function runSeed(db: any): Promise<void> {
  log('Seeding constants (RBAC actions, resources, capabilities, access groups, roles)');
  await seedRbac();
  await db.collection('migrations').updateOne(
    { name: 'seed-rbac' },
    { $set: { name: 'seed-rbac', completedAt: new Date() } },
    { upsert: true },
  );
  log('[Seed] Constants seeding complete. Existing book/user data was not modified or deleted.');
}

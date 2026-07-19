import mongoose from 'mongoose';
import { config } from '../src/config/index';

async function main() {
  console.log('Connecting to:', config.mongodbUri);
  await mongoose.connect(config.mongodbUri);
  const db = mongoose.connection.db;

  if(!db) {
    console.log('no db found')
    return;
  }

  const collections = (await db.listCollections().toArray()).map((c) => c.name).sort();
  console.log('\nCollections in database:', collections.length ? collections.join(', ') : '(none)');

  const keyNames = [
    'books',
    'userbooks',
    'bookcontents',
    'rawbookcontents',
    'bookvisits',
    'migrations',
    'users',
    'roles',
    'actions',
    'resources',
    'capabilities',
    'accessgroups',
  ];

  for (const name of keyNames) {
    if (!collections.includes(name)) continue;
    const count = await db.collection(name).countDocuments();
    console.log(`  ${name}: ${count} document(s)`);
  }

  const migrations = collections.includes('migrations')
    ? await db.collection('migrations').find({}, { projection: { name: 1, completedAt: 1 } }).toArray()
    : [];
  if (migrations.length) {
    console.log('\nMigration markers:');
    for (const m of migrations) {
      console.log(`  ${m.name}: ${m.completedAt}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

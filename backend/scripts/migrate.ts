/// <reference types="node" />
import process from 'node:process';
import mongoose from 'mongoose';
import { config } from '../src/config/index';
import { seedRbac } from '../src/services/seed';

const MONGODB_URI = config.mongodbUri;

interface Migration {
  name: string;
  marker: string;
  description: string;
  run: (db: any, dryRun: boolean) => Promise<void>;
  supportsDryRun: boolean;
}

const MIGRATIONS: Migration[] = [
  {
    name: 'seed-rbac',
    marker: 'seed-rbac',
    description: 'Seed system RBAC actions, resources, capabilities, access groups and roles',
    run: async (_db, dryRun) => {
      if (dryRun) {
        console.log('[dry-run] would seed system RBAC data');
        return;
      }
      await seedRbac();
    },
    supportsDryRun: true,
  },
];

function printHelp() {
  console.log(`
Usage: tsx migrate.ts [options] [command]

A single migration runner. Runs migrations in order and records completed
migrations in the 'migrations' collection. Migrations are idempotent and will
skip if already completed unless --force is used.

Options:
  --dry-run        Show what would happen without writing to the database.
  --force          Re-run migrations even if they are already completed.
  --up-to <name>   Run migrations up to and including <name>.
  --only <name>    Run only the migration named <name>.
  --list           Show the status of all migrations and exit.
  --help           Show this help message and exit.
`);
}

async function getMigrationsCollection(db: any) {
  return db.collection('migrations');
}

async function isCompleted(collection: any, marker: string): Promise<boolean> {
  const record = await collection.findOne({ name: marker });
  return !!record;
}

async function recordCompleted(collection: any, marker: string, dryRun: boolean) {
  if (dryRun) return;
  await collection.updateOne({ name: marker }, { $set: { name: marker, completedAt: new Date() } }, { upsert: true });
}

async function clearCompleted(collection: any, marker: string) {
  await collection.deleteOne({ name: marker });
}

async function listMigrations(collection: any) {
  console.log('Migration status:');
  for (const migration of MIGRATIONS) {
    const completed = await isCompleted(collection, migration.marker);
    console.log(`  ${completed ? '✓' : ' '} ${migration.name}: ${migration.description}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const list = args.includes('--list');
  const help = args.includes('--help') || args.includes('-h');
  const upToIndex = args.indexOf('--up-to');
  const upTo = upToIndex !== -1 ? args[upToIndex + 1] : undefined;
  const onlyIndex = args.indexOf('--only');
  const only = onlyIndex !== -1 ? args[onlyIndex + 1] : undefined;

  if (help) {
    printHelp();
    return;
  }

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const migrationsCollection = await getMigrationsCollection(db);

  try {
    if (list) {
      await listMigrations(migrationsCollection);
      return;
    }

    let migrations = MIGRATIONS;

    if (upTo) {
      const index = MIGRATIONS.findIndex((m) => m.name === upTo);
      if (index === -1) {
        throw new Error(`Unknown migration: ${upTo}`);
      }
      migrations = MIGRATIONS.slice(0, index + 1);
    }

    if (only) {
      const migration = MIGRATIONS.find((m) => m.name === only);
      if (!migration) {
        throw new Error(`Unknown migration: ${only}`);
      }
      migrations = [migration];
    }

    for (const migration of migrations) {
      const completed = await isCompleted(migrationsCollection, migration.marker);

      if (completed && !force) {
        console.log(`Skipping '${migration.name}': already completed`);
        continue;
      }

      if (dryRun && !migration.supportsDryRun) {
        console.log(`[dry-run] '${migration.name}': dry-run not supported for this migration; skipping`);
        continue;
      }

      if (force && completed) {
        await clearCompleted(migrationsCollection, migration.marker);
        console.log(`Cleared marker for '${migration.name}' (forced re-run)`);
      }

      console.log(`Running migration: ${migration.name}`);
      await migration.run(db, dryRun);

      await recordCompleted(migrationsCollection, migration.marker, dryRun);
      console.log(`Completed migration: ${migration.name}${dryRun ? ' (dry-run)' : ''}`);
    }

    console.log('Migration run finished.');
  } catch (err: any) {
    console.error('Migration run failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();

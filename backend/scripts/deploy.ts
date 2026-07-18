/**
 * Deployment orchestration script.
 *
 * Flow:
 * 1. Connect to MongoDB.
 * 2. Create a full pre-migration backup (backups/<identifier>/pre).
 *    - If backup fails, stop immediately and do not run migrations.
 * 3. Run migrations (legacy -> unit-to-chapter -> rbac-unit-to-chapter).
 * 4. Run RBAC/constant seeding (idempotent).
 * 5. Create a full post-migration backup (backups/<identifier>/post).
 * 6. Verify every document in pre vs post backups.
 * 7. Write report.log, counts.json, and diff.json inside the identifier folder.
 *
 * Usage:
 *   npx tsx scripts/deploy.ts
 */
import process from 'node:process';
import mongoose from 'mongoose';
import { config } from '../src/config/index';
import { log } from './lib/mongodb-tools.js';
import { createBackup } from './lib/backup.js';
import { runMigrations } from './lib/migrate.js';
import { runSeed } from './lib/seed.js';
import { runVerify } from './lib/verify.js';
import { writeReport } from './lib/report.js';
import type { BackupResult, VerifyResult } from './lib/types.js';

const MONGODB_URI = config.mongodbUri;

function timestampLabel(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function getDbName(): Promise<string> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');
  return db.databaseName;
}

interface StepRecord {
  name: string;
  ok: boolean;
  message: string;
}

function pushStep(steps: StepRecord[], name: string, ok: boolean, message: string): void {
  steps.push({ name, ok, message });
}

async function main() {
  const startedAt = new Date().toISOString();
  const identifier = `deploy-${timestampLabel()}`;
  const steps: StepRecord[] = [];

  console.log('Connecting to:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');
  const dbName = await getDbName();
  log('Connected to database:', dbName);

  let preBackup: BackupResult | undefined;
  let postBackup: BackupResult | undefined;
  let verifyResult: VerifyResult | undefined;

  try {
    log(`Starting deployment identifier: ${identifier}`);

    preBackup = await createBackup({ identifier, stage: 'pre', dbName });
    pushStep(steps, 'pre-backup', true, `created at ${preBackup.dir}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('\n[ERROR] Pre-migration backup failed. Migration has been ABORTED to avoid data loss.');
    console.error(msg);
    pushStep(steps, 'pre-backup', false, msg);
    await writeReport({ identifier, startedAt, steps, pre: preBackup ?? { dir: '', counts: {}, docs: {} } });
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  try {
    await runMigrations(db);
    pushStep(steps, 'migrations', true, 'legacy, unit-to-chapter, rbac-unit-to-chapter complete');
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('\n[ERROR] Migration failed:', msg);
    pushStep(steps, 'migrations', false, msg);
    await writeReport({ identifier, startedAt, steps, pre: preBackup });
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  try {
    await runSeed(db);
    pushStep(steps, 'seed', true, 'RBAC constants seeded');
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('\n[ERROR] Seed failed:', msg);
    pushStep(steps, 'seed', false, msg);
    await writeReport({ identifier, startedAt, steps, pre: preBackup });
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  try {
    postBackup = await createBackup({ identifier, stage: 'post', dbName });
    pushStep(steps, 'post-backup', true, `created at ${postBackup.dir}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('\n[WARN] Post-migration backup failed:', msg);
    pushStep(steps, 'post-backup', false, msg);
  }

  if (preBackup && postBackup) {
    try {
      verifyResult = await runVerify({ pre: preBackup, post: postBackup });
      for (const message of verifyResult.messages) console.log(message);
      pushStep(steps, 'verify', verifyResult.ok, verifyResult.ok ? 'document-level verification passed' : 'document-level verification failed');
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('\n[ERROR] Verify failed:', msg);
      pushStep(steps, 'verify', false, msg);
    }
  }

  await writeReport({ identifier, startedAt, steps, pre: preBackup, post: postBackup, verify: verifyResult });

  console.log('\nBackup locations:');
  console.log(`  Pre : backups/${identifier}/pre`);
  if (postBackup) console.log(`  Post: backups/${identifier}/post`);
  console.log(`  Report: backups/${identifier}/report.log`);

  const ok = steps.every((s) => s.ok) && (verifyResult?.ok ?? true);
  if (!ok) {
    console.error('\n[ERROR] Deployment failed. Restore from the pre-migration backup if needed.');
    process.exitCode = 1;
  } else {
    console.log('\n[OK] Deploy, migration, seed, and verification completed successfully.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Unexpected error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

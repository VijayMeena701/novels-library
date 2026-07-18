import { join, resolve } from 'node:path';
import { config } from '../../src/config/index';
import {
  captureOutput,
  resolveBinary,
  binaryExists,
  ensureDir,
  log,
  redactUri,
  parseBackupCounts,
  readBackupCollection,
} from './mongodb-tools.js';
import type { BackupResult } from './types.js';

const MONGODB_URI = config.mongodbUri;

export async function createBackup({
  identifier,
  stage,
  dbName,
}: {
  identifier: string;
  stage: 'pre' | 'post';
  dbName: string;
}): Promise<BackupResult> {
  const backupDir = resolve(`backups/${identifier}/${stage}`);
  const dataDir = join(backupDir, 'data');
  await ensureDir(dataDir);

  const mongodump = resolveBinary('mongodump');
  if (!(await binaryExists(mongodump))) {
    throw new Error('mongodump not found. Install MongoDB Database Tools or set MONGODB_TOOLS_DIR.');
  }

  log(`Creating ${stage} backup: ${backupDir}`);
  log(`Source: ${redactUri(MONGODB_URI)}`);

  const output = await captureOutput(
    mongodump,
    ['--uri', MONGODB_URI, '--db', dbName, '--out', dataDir, '--gzip'],
    { includeStderr: true },
  );

  const counts = parseBackupCounts(output, dbName);
  log(`${stage} backup complete: ${backupDir} (${Object.keys(counts).length} collections, ${Object.values(counts).reduce((a, b) => a + b, 0)} documents)`);

  // Load all documents for later verification.
  const docs: Record<string, any[]> = {};
  for (const collectionName of Object.keys(counts)) {
    docs[collectionName] = await readBackupCollection(backupDir, dbName, collectionName);
  }

  return { dir: backupDir, counts, docs };
}

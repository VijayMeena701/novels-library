/// <reference types="node" />
import process from 'node:process';
import { readdir, stat, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from '../src/config/index';
import { log, resolveBinary, binaryExists, runCommand } from './lib/mongodb-tools.js';

const MONGODB_URI = config.mongodbUri;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_DATA_EXPORT_DIR = join(__dirname, '..', 'data_export');

const IMPORT_ORDER: Record<string, number> = {
  novels: 0,
  usernovels: 1,
  chaptercontents: 2,
  rawchaptercontents: 3,
  chaptervisits: 4,
};

function collectionNameFromFile(filename: string): string | undefined {
  if (!filename.endsWith('.json') || filename.endsWith('.metadata.json')) return undefined;
  // Assumes filename format: <database>.<collection>.json
  const withoutExt = filename.replace(/\.json$/, '');
  const dotIndex = withoutExt.indexOf('.');
  if (dotIndex === -1) return undefined;
  return withoutExt.slice(dotIndex + 1);
}

function importOrder(collectionName: string): number {
  return IMPORT_ORDER[collectionName] ?? 1000;
}

interface ImportFile {
  filename: string;
  collection: string;
  path: string;
}

async function findImportFiles(dataDir: string): Promise<ImportFile[]> {
  const entries = await readdir(dataDir, { withFileTypes: true });
  const files: ImportFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const collection = collectionNameFromFile(entry.name);
    if (!collection) continue;
    files.push({ filename: entry.name, collection, path: join(dataDir, entry.name) });
  }
  files.sort((a, b) => importOrder(a.collection) - importOrder(b.collection));
  return files;
}

async function isEmptyJsonArray(filePath: string): Promise<boolean> {
  try {
    const { size } = await stat(filePath);
    // Empty arrays are tiny; avoid reading large export files into memory.
    if (size > 8192) return false;
    const content = await readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    return Array.isArray(data) && data.length === 0;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const drop = args.includes('--drop');
  const dataDir = process.env.DATA_EXPORT_DIR || DEFAULT_DATA_EXPORT_DIR;

  console.log('Connecting to:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  const importBin = resolveBinary('mongoimport');
  if (!(await binaryExists(importBin))) {
    throw new Error(`mongoimport not found at ${importBin}. Set mongodbToolsDir in config or add it to PATH.`);
  }

  const files = await findImportFiles(dataDir);
  if (files.length === 0) {
    console.log(`No .json files found in ${dataDir}`);
    await mongoose.disconnect();
    return;
  }

  log(`Found ${files.length} data export file(s) in ${dataDir}`);
  for (const file of files) log(`  ${file.filename} -> ${file.collection}`);

  for (const file of files) {
    if (drop) {
      try {
        await db.collection(file.collection).drop();
        log(`Dropped existing collection: ${file.collection}`);
      } catch (err: any) {
        if (err.codeName !== 'NamespaceNotFound') throw err;
        log(`Collection ${file.collection} did not exist`);
      }
    }

    if (await isEmptyJsonArray(file.path)) {
      log(`Skipping ${file.filename} (empty array)`);
      continue;
    }

    log(`Importing ${file.filename} into collection ${file.collection}`);
    await runCommand(importBin, [
      '--uri', MONGODB_URI,
      '--collection', file.collection,
      '--file', file.path,
      '--jsonArray',
      '--mode', 'upsert',
      '--upsertFields', '_id',
      '--stopOnError',
    ]);
    log(`Imported ${file.filename}`);
  }

  console.log('[OK] Data export import complete.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Import failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
  mongoose.disconnect().catch(() => {});
});

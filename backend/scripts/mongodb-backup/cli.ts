#!/usr/bin/env node
/**
 * Interactive MongoDB backup / restore / clone CLI.
 *
 * Uses backend node_modules (mongoose) and the shared backend config.
 *
 * Usage:
 *   tsx cli.ts
 */
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { access, readdir, rm } from 'node:fs/promises';
import readline from 'node:readline/promises';
import { config } from '../../src/config/index';
import { ensureDir, listDatabases, listCollections, resolveBinary, binaryExists, runCommand, readJson } from './common';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backupScript = join(__dirname, 'backup.ts');
const restoreScript = join(__dirname, 'restore.ts');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function ask(prompt: string, defaultValue = ''): Promise<string> {
  const p = defaultValue ? `${prompt} [${defaultValue}]: ` : `${prompt}: `;
  const answer = await rl.question(p);
  return answer.trim() || defaultValue;
}

async function confirm(prompt: string, defaultValue = false): Promise<boolean> {
  const defaultChar = defaultValue ? 'Y/n' : 'y/N';
  const answer = await rl.question(`${prompt} [${defaultChar}]: `);
  if (!answer.trim()) return defaultValue;
  return answer.trim().toLowerCase().startsWith('y');
}

async function choose(prompt: string, options: string[], defaultValue = ''): Promise<string | null> {
  console.log(`\n${prompt}`);
  options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
  const defaultText = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await rl.question(`Select (number or name)${defaultText}: `);
  const text = answer.trim();
  if (!text) return defaultValue || null;
  const idx = parseInt(text, 10) - 1;
  if (idx >= 0 && idx < options.length) return options[idx];
  const match = options.find((o) => o.toLowerCase() === text.toLowerCase());
  return match || null;
}

async function chooseRequired(prompt: string, options: string[], defaultValue = ''): Promise<string> {
  let choice: string | null = null;
  while (!choice) {
    choice = await choose(prompt, options, defaultValue);
    if (!choice) console.log('Invalid selection, try again.');
  }
  return choice;
}

async function askMultiSelect(prompt: string, items: string[] | null, defaultValue = ''): Promise<string[] | null> {
  if (!items || items.length === 0) {
    const typed = await ask(`${prompt} (comma-separated)`, defaultValue);
    return (
      typed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) || null
    );
  }
  console.log(`\n${prompt}`);
  items.forEach((it, i) => console.log(`  ${i + 1}. ${it}`));
  const answer = await rl.question('Select numbers/names separated by commas, or "all": ');
  const text = answer.trim().toLowerCase();
  if (!text || text === 'all' || text === 'none') return null;
  const selected = new Set<string>();
  for (const part of text.split(',')) {
    const raw = part.trim();
    if (!raw) continue;
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= items.length) {
      selected.add(items[n - 1]);
    } else {
      selected.add(raw);
    }
  }
  return selected.size ? [...selected] : null;
}

function defaultBackupDir(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `mongodb-backups/${ts}`;
}

async function findBackupDirs(): Promise<string[]> {
  try {
    const entries = await readdir('mongodb-backups', { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function chooseDatabase(uri: string): Promise<string | null> {
  const choice = await chooseRequired('Database selection', ['All databases', 'Specific database']);
  if (choice === 'All databases') return null;
  const dbs = await listDatabases(uri);
  if (dbs && dbs.length) {
    const manual = 'Type manually';
    const selected = await chooseRequired('Select database', [...dbs, manual]);
    if (selected !== manual) return selected;
  }
  return await ask('Database name');
}

async function chooseCollections(uri: string, dbName: string | null): Promise<string[] | null> {
  if (!dbName) return null;
  const all = await confirm(`Use all collections in "${dbName}"?`, true);
  if (all) return null;
  const collections = await listCollections(uri, dbName);
  return await askMultiSelect('Collections to include', collections || []);
}

async function chooseDatabaseFromBackup(backupDir: string): Promise<string | null> {
  const choice = await chooseRequired('Database selection', ['All databases', 'Specific database']);
  if (choice === 'All databases') return null;
  let summary: { databases?: { name: string }[] } | null = null;
  try {
    summary = (await readJson(join(backupDir, 'metadata', 'summary.json'))) as { databases?: { name: string }[] };
  } catch {
    summary = null;
  }
  if (summary && summary.databases && summary.databases.length) {
    const dbNames = summary.databases.map((d) => d.name);
    const manual = 'Type manually';
    const selected = await chooseRequired('Select database', [...dbNames, manual]);
    if (selected !== manual) return selected;
  }
  return await ask('Database name');
}

async function chooseCollectionsFromBackup(backupDir: string, dbName: string | null): Promise<string[] | null> {
  if (!dbName) return null;
  const all = await confirm(`Use all collections in "${dbName}"?`, true);
  if (all) return null;
  let summary: { collections?: { database: string; collectionName: string }[] } | null = null;
  try {
    summary = (await readJson(join(backupDir, 'metadata', 'summary.json'))) as {
      collections?: { database: string; collectionName: string }[];
    };
  } catch {
    summary = null;
  }
  const collections = summary
    ? summary.collections?.filter((c) => c.database === dbName).map((c) => c.collectionName) || []
    : [];
  return await askMultiSelect('Collections to restore', collections);
}

interface AtlasCreds {
  publicKey?: string;
  privateKey?: string;
  groupId?: string;
  appId?: string;
}

async function doExport(
  sourceUri: string,
  dbName: string | null,
  collections: string[] | null,
  includeAtlas: boolean,
  backupDir: string,
  atlasCreds: AtlasCreds,
): Promise<void> {
  const args = ['--import', 'tsx', backupScript, '--source', sourceUri, '--out', backupDir];
  if (dbName) args.push('--db', dbName);
  if (collections && dbName) {
    for (const coll of collections) {
      args.push('--ns-include', `${dbName}.${coll}`);
    }
  }
  if (includeAtlas) {
    args.push('--include-atlas');
    if (atlasCreds.publicKey) process.env.ATLAS_PUBLIC_KEY = atlasCreds.publicKey;
    if (atlasCreds.privateKey) process.env.ATLAS_PRIVATE_KEY = atlasCreds.privateKey;
    if (atlasCreds.groupId) process.env.ATLAS_GROUP_ID = atlasCreds.groupId;
    if (atlasCreds.appId) process.env.ATLAS_APP_ID = atlasCreds.appId;
  }
  await runCommand(process.execPath, args);
}

interface ImportOptions {
  drop: boolean;
  sourceDbName: string | null;
  targetDbName: string | null;
  collections: string[] | null;
  stopOnError?: boolean;
}

async function doImport(backupDir: string, targetUri: string, options: ImportOptions): Promise<void> {
  const { drop, sourceDbName, targetDbName, collections, stopOnError } = options;
  const args = ['--import', 'tsx', restoreScript, '--target', targetUri, '--backup', backupDir];
  if (drop) args.push('--drop');
  if (stopOnError) args.push('--stop-on-error');
  if (sourceDbName && collections) {
    for (const coll of collections) args.push('--ns-include', `${sourceDbName}.${coll}`);
    if (targetDbName && sourceDbName !== targetDbName) {
      args.push('--ns-from', `${sourceDbName}.*`, '--ns-to', `${targetDbName}.*`);
    }
  } else if (sourceDbName) {
    args.push('--ns-include', `${sourceDbName}.*`);
    if (targetDbName && sourceDbName !== targetDbName) {
      args.push('--ns-from', `${sourceDbName}.*`, '--ns-to', `${targetDbName}.*`);
    }
  }
  await runCommand(process.execPath, args);
}

interface CloneOptions {
  drop?: boolean;
  targetDbName?: string | null;
  stopOnError?: boolean;
  tempDir?: string;
}

async function doClone(
  sourceUri: string,
  dbName: string | null,
  collections: string[] | null,
  targetUri: string,
  options: CloneOptions = {},
): Promise<void> {
  const { drop = false, targetDbName = null, stopOnError, tempDir } = options;
  const temp = tempDir || `mongodb-backups/.clone-${Date.now()}`;
  await ensureDir(temp);
  try {
    await doExport(sourceUri, dbName, collections, false, temp, {});
    await doImport(temp, targetUri, { drop, sourceDbName: dbName, targetDbName, collections, stopOnError });
  } finally {
    try {
      await rm(temp, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

async function exportFlow(): Promise<void> {
  console.log('\n--- Export / Backup ---');
  const sourcePreset = await chooseRequired('Source location', ['Cloud (Atlas)', 'Local', 'Custom URI']);
  const sourceDefault =
    sourcePreset === 'Local' ? config.targetMongodbUri || 'mongodb://127.0.0.1:27017' : config.sourceMongodbUri || '';
  const sourceUri = await ask('Source MongoDB URI', sourceDefault);
  const dbName = await chooseDatabase(sourceUri);
  const collections = await chooseCollections(sourceUri, dbName);
  const includeAtlas = await confirm('Include Atlas App Services export (triggers/functions)?', false);
  const atlasCreds: AtlasCreds = {};
  if (includeAtlas) {
    atlasCreds.publicKey = await ask('Atlas Public Key', config.atlasPublicKey || '');
    atlasCreds.privateKey = await ask('Atlas Private Key', config.atlasPrivateKey || '');
    atlasCreds.groupId = await ask('Atlas Group/Project ID', config.atlasGroupId || '');
    atlasCreds.appId = await ask('Atlas App ID', config.atlasAppId || '');
  }
  const backupDir = await ask('Backup output directory', config.backupDir || defaultBackupDir());
  await doExport(sourceUri, dbName, collections, includeAtlas, backupDir, atlasCreds);
}

async function importFlow(): Promise<void> {
  console.log('\n--- Import / Restore ---');
  const backupDirs = await findBackupDirs();
  let backupDir = '';
  if (backupDirs.length) {
    const manual = 'Other path';
    const selected = await chooseRequired('Choose backup', [...backupDirs, manual]);
    backupDir = selected === manual ? await ask('Backup directory path') : join('mongodb-backups', selected);
  } else {
    backupDir = await ask('Backup directory path', config.backupDir || '');
  }
  const targetPreset = await chooseRequired('Target location', ['Local', 'Cloud (Atlas)', 'Custom URI']);
  const targetDefault =
    targetPreset === 'Local' ? config.targetMongodbUri || 'mongodb://127.0.0.1:27017' : config.targetMongodbUri || '';
  const targetUri = await ask('Target MongoDB URI', targetDefault);
  const sourceDbName = await chooseDatabaseFromBackup(backupDir);
  const collections = await chooseCollectionsFromBackup(backupDir, sourceDbName);
  let targetDbName: string | null = null;
  if (sourceDbName) {
    const same = await confirm(`Restore database "${sourceDbName}" to the same name on target?`, true);
    if (!same) targetDbName = await ask('Target database name');
  }
  const drop = await confirm('Drop existing collections before restoring? (skip if you want to merge)', false);
  await doImport(backupDir, targetUri, { drop, sourceDbName, targetDbName, collections });
}

async function cloneFlow(): Promise<void> {
  console.log('\n--- Clone ---');
  const sourcePreset = await chooseRequired('Source location', ['Cloud (Atlas)', 'Local', 'Custom URI']);
  const sourceDefault =
    sourcePreset === 'Local' ? config.targetMongodbUri || 'mongodb://127.0.0.1:27017' : config.sourceMongodbUri || '';
  const sourceUri = await ask('Source MongoDB URI', sourceDefault);
  const dbName = await chooseDatabase(sourceUri);
  const collections = await chooseCollections(sourceUri, dbName);
  const targetPreset = await chooseRequired('Target location', ['Local', 'Cloud (Atlas)', 'Custom URI']);
  const targetDefault =
    targetPreset === 'Local' ? config.targetMongodbUri || 'mongodb://127.0.0.1:27017' : config.targetMongodbUri || '';
  const targetUri = await ask('Target MongoDB URI', targetDefault);
  let targetDbName: string | null = null;
  if (dbName) {
    const same = await confirm(`Clone database "${dbName}" to the same name on target?`, true);
    if (!same) targetDbName = await ask('Target database name');
  }
  const drop = await confirm('Drop existing collections on target before restoring?', false);
  await doClone(sourceUri, dbName, collections, targetUri, { drop, targetDbName });
}

interface BackupConfig {
  mode: 'export' | 'import' | 'clone';
  source?: string;
  target?: string;
  backupDir?: string | null;
  database?: string | null;
  collections?: string[] | null;
  includeAtlas?: boolean;
  atlas?: AtlasCreds;
  rename?: { source: string; target: string };
  stopOnError?: boolean;
  drop?: boolean;
  toolsDir?: string;
}

async function loadConfig(filePath: string): Promise<BackupConfig> {
  const raw = (await readJson(filePath)) as Record<string, unknown>;
  if (!raw.source) raw.source = config.sourceMongodbUri;
  if (!raw.target) raw.target = config.targetMongodbUri;
  if (raw.mode === 'export' && !raw.backupDir) raw.backupDir = config.backupDir || defaultBackupDir();
  if (raw.mode === 'import' && !raw.backupDir) raw.backupDir = config.backupDir;
  return validateConfig(raw);
}

function validateConfig(configInput: Record<string, unknown>): BackupConfig {
  if (!configInput || typeof configInput !== 'object') {
    throw new Error('Config must be a JSON object');
  }
  if (!configInput.mode || !['export', 'import', 'clone'].includes(String(configInput.mode).toLowerCase())) {
    throw new Error('config.mode must be export, import, or clone');
  }
  const config = configInput as unknown as BackupConfig;
  config.mode = config.mode.toLowerCase() as BackupConfig['mode'];

  if ((config.mode === 'export' || config.mode === 'clone') && !config.source) {
    throw new Error('source URI is required for export/clone');
  }
  if ((config.mode === 'import' || config.mode === 'clone') && !config.target) {
    throw new Error('target URI is required for import/clone');
  }
  if (config.mode === 'export' && !config.backupDir) {
    config.backupDir = defaultBackupDir();
  }
  if (config.mode === 'import' && !config.backupDir) {
    throw new Error('backupDir is required for import');
  }
  if (config.collections && !Array.isArray(config.collections)) {
    throw new Error('collections must be an array');
  }
  if (config.collections && config.collections.length > 0 && !config.database) {
    throw new Error('database is required when collections are specified');
  }
  if (config.collections && Array.isArray(config.collections) && config.collections.length === 0) {
    config.collections = null;
  }
  if (config.includeAtlas) {
    if (
      !config.atlas ||
      !config.atlas.publicKey ||
      !config.atlas.privateKey ||
      !config.atlas.groupId ||
      !config.atlas.appId
    ) {
      throw new Error('atlas publicKey, privateKey, groupId, appId are required when includeAtlas is true');
    }
  }
  if (config.rename && (!config.rename.source || !config.rename.target)) {
    throw new Error('rename must be an object with source and target database names');
  }
  if (config.stopOnError !== undefined && typeof config.stopOnError !== 'boolean') {
    throw new Error('stopOnError must be a boolean');
  }
  if (config.drop !== undefined && typeof config.drop !== 'boolean') {
    throw new Error('drop must be a boolean');
  }
  return config;
}

async function runFromConfig(backupConfig: BackupConfig): Promise<void> {
  if (backupConfig.toolsDir) process.env.MONGODB_TOOLS_DIR = backupConfig.toolsDir;
  const mongodump = resolveBinary('mongodump', backupConfig.toolsDir);
  const mongorestore = resolveBinary('mongorestore', backupConfig.toolsDir);
  if (!(await binaryExists(mongodump))) {
    throw new Error('mongodump not found. Install MongoDB Database Tools or set MONGODB_TOOLS_DIR.');
  }
  if ((backupConfig.mode === 'import' || backupConfig.mode === 'clone') && !(await binaryExists(mongorestore))) {
    throw new Error('mongorestore not found. Install MongoDB Database Tools or set MONGODB_TOOLS_DIR.');
  }
  if (backupConfig.mode === 'import') {
    try {
      await access(backupConfig.backupDir as string);
    } catch {
      throw new Error(`Backup directory not found: ${backupConfig.backupDir}`);
    }
  }
  const targetDbName = backupConfig.rename ? backupConfig.rename.target : null;
  if (backupConfig.mode === 'export') {
    await doExport(
      backupConfig.source as string,
      backupConfig.database || null,
      backupConfig.collections || null,
      backupConfig.includeAtlas || false,
      backupConfig.backupDir as string,
      backupConfig.atlas || {},
    );
  } else if (backupConfig.mode === 'import') {
    await doImport(backupConfig.backupDir as string, backupConfig.target as string, {
      drop: backupConfig.drop || false,
      sourceDbName: backupConfig.database || null,
      targetDbName,
      collections: backupConfig.collections || null,
      stopOnError: backupConfig.stopOnError,
    });
  } else if (backupConfig.mode === 'clone') {
    await doClone(
      backupConfig.source as string,
      backupConfig.database || null,
      backupConfig.collections || null,
      backupConfig.target as string,
      {
        drop: backupConfig.drop || false,
        targetDbName,
        stopOnError: backupConfig.stopOnError,
      },
    );
  }
}

async function configMode(): Promise<void> {
  const configPath = await ask('Config file path', 'mongodb-backup-config.json');
  const backupConfig = await loadConfig(configPath);
  console.log(
    `Loaded config: mode=${backupConfig.mode}, source=${backupConfig.source || '-'}, target=${backupConfig.target || '-'}, backupDir=${backupConfig.backupDir || '-'}`,
  );
  await runFromConfig(backupConfig);
  console.log('Config run complete.');
}

async function manualMode(): Promise<void> {
  const toolsDir = await ask(
    'MongoDB Tools directory (mongodump/mongorestore) - leave blank for PATH',
    config.mongodbToolsDir || '',
  );
  if (toolsDir) process.env.MONGODB_TOOLS_DIR = toolsDir;
  const mongodump = resolveBinary('mongodump', toolsDir);
  if (!(await binaryExists(mongodump))) {
    console.log('Warning: mongodump not found. Install MongoDB Database Tools or set the directory.');
  }
  let running = true;
  while (running) {
    const action = await chooseRequired('Main menu', ['Export', 'Import', 'Clone', 'Exit']);
    try {
      if (action === 'Export') await exportFlow();
      else if (action === 'Import') await importFlow();
      else if (action === 'Clone') await cloneFlow();
      else if (action === 'Exit') {
        running = false;
        console.log('Goodbye.');
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
    }
  }
}

async function main(): Promise<void> {
  console.log('=== MongoDB Backup / Restore / Clone CLI ===\n');
  const startMode = await chooseRequired('Select mode', ['Config file', 'Manual interactive']);
  if (startMode === 'Config file') {
    await configMode();
  } else {
    await manualMode();
  }
  rl.close();
}

main();

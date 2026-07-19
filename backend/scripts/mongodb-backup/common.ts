/**
 * Shared helpers for MongoDB backup/restore scripts.
 * Uses backend node_modules (mongoose) and the shared backend config.
 */
import { spawn, SpawnOptions } from 'node:child_process';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import process from 'node:process';
import mongoose from 'mongoose';
import { config } from '../../src/config/index';

export const IS_WIN = process.platform === 'win32';

export function log(msg: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`, ...args);
}

export function errorExit(msg: string, code = 1): never {
  console.error(`[ERROR] ${msg}`);
  process.exit(code);
}

export function redactUri(uri: string | undefined): string | undefined {
  if (!uri) return uri;
  return uri.replace(/\/\/([^/:@]+):([^/:@]+)@/, '//$1:***@');
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export function resolveBinary(name: string, toolsDir = config.mongodbToolsDir): string {
  let bin = name;
  if (toolsDir) {
    const dir = resolve(toolsDir);
    bin = join(dir, name);
    if (IS_WIN && !extname(bin)) {
      bin += '.exe';
    }
  }
  return bin;
}

export async function binaryExists(bin: string): Promise<boolean> {
  const hasExt = Boolean(extname(bin));
  if (bin.includes(sep)) {
    try {
      await access(bin);
      return true;
    } catch {
      if (!hasExt && IS_WIN) {
        try {
          await access(`${bin}.exe`);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }
  return true; // bare command in PATH; trust runCommand to catch ENOENT
}

interface RunCommandOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  includeStderr?: boolean; // only used by captureOutput
}

export async function runCommand(cmd: string, args: string[], options: RunCommandOptions = {}): Promise<void> {
  const { env, cwd } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env, cwd, windowsHide: true } as SpawnOptions);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}: ${cmd} ${args.join(' ')}`));
    });
  });
}

export async function captureOutput(cmd: string, args: string[], options: RunCommandOptions = {}): Promise<string> {
  const { env, cwd, includeStderr } = options;
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(cmd, args, { stdio: 'pipe', env, cwd, windowsHide: true } as SpawnOptions);
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        const out = includeStderr ? `${stdout}\n${stderr}`.trim() : stdout.trim();
        resolve(out);
      } else {
        reject(
          new Error(
            `Command failed: ${cmd} ${args.join(' ')}
${stderr || stdout}`.trim(),
          ),
        );
      }
    });
  });
}

export interface CollectionSummary {
  collectionName: string;
  database: string;
  type: string;
  options: Record<string, unknown>;
  validator: unknown;
  validationLevel: string | null;
  validationAction: string | null;
  indexes: unknown[];
  metadataFile: string;
}

export interface DatabaseSummary {
  name: string;
  collections: string[];
}

export interface BackupSummary {
  generatedAt: string;
  databases: DatabaseSummary[];
  collections: CollectionSummary[];
}

export async function parseMetadataSummary(backupDir: string): Promise<BackupSummary> {
  const dataDir = join(backupDir, 'data');
  const summary: BackupSummary = { generatedAt: new Date().toISOString(), databases: [], collections: [] };
  const dbEntries = await readdir(dataDir, { withFileTypes: true }).catch(() => []);
  for (const dbEntry of dbEntries) {
    if (!dbEntry.isDirectory()) continue;
    const dbName = dbEntry.name;
    const dbPath = join(dataDir, dbName);
    const files = await readdir(dbPath);
    const dbCollections: string[] = [];
    for (const file of files) {
      if (!file.endsWith('.metadata.json')) continue;
      const meta = JSON.parse(await readFile(join(dbPath, file), 'utf8')) as {
        collectionName?: string;
        databaseName?: string;
        ns?: { database?: string; collection?: string };
        type?: string;
        options?: { validator?: unknown; validationLevel?: string; validationAction?: string };
        indexes?: unknown[];
      };
      const collectionName = meta.collectionName || meta.ns?.collection || file.replace(/\.metadata\.json$/, '');
      const database = meta.databaseName || meta.ns?.database || dbName;
      const options = meta.options || {};
      const validator = options.validator || null;
      const validationLevel = options.validationLevel || null;
      const validationAction = options.validationAction || null;
      const indexes = meta.indexes || [];
      summary.collections.push({
        collectionName,
        database,
        type: meta.type || 'collection',
        options,
        validator,
        validationLevel,
        validationAction,
        indexes,
        metadataFile: `data/${dbName}/${file}`,
      });
      dbCollections.push(collectionName);
    }
    summary.databases.push({ name: dbName, collections: dbCollections });
  }
  return summary;
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function listDatabases(uri: string): Promise<string[] | null> {
  let conn: mongoose.Connection | undefined;
  try {
    conn = mongoose.createConnection(uri);
    await conn.asPromise();
    const { databases } = await conn.db!.admin().listDatabases();
    return databases.map((d) => d.name);
  } catch (err) {
    log('Could not list databases:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {
        /* ignore */
      }
    }
  }
}

export async function listCollections(uri: string, dbName: string): Promise<string[] | null> {
  if (!dbName) return null;
  let conn: mongoose.Connection | undefined;
  try {
    conn = mongoose.createConnection(uri);
    await conn.asPromise();
    const target = conn.useDb(dbName);
    const collections = await target.db!.listCollections().toArray();
    return collections.map((c) => c.name);
  } catch (err) {
    log('Could not list collections:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Shared helpers for MongoDB backup/restore/migration scripts.
 * Re-exports the original mongodb-backup helpers and adds BSON/backup parsing utilities.
 */
export * from '../mongodb-backup/common.js';

import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { BSON, ObjectId } from 'bson';

export { ObjectId };

export function readBsonDocuments(buffer: Buffer): any[] {
  const docs: any[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const len = buffer.readInt32LE(offset);
    if (len <= 0 || offset + len > buffer.length) break;
    const doc = BSON.deserialize(buffer.subarray(offset, offset + len));
    docs.push(doc);
    offset += len;
  }
  return docs;
}

export async function readBackupCollection(
  backupDir: string,
  dbName: string,
  collectionName: string,
): Promise<any[]> {
  const filePath = join(backupDir, 'data', dbName, `${collectionName}.bson.gz`);
  const compressed = await readFile(filePath);
  const decompressed = gunzipSync(compressed);
  return readBsonDocuments(decompressed);
}

export function parseBackupCounts(output: string, dbName: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const regex = new RegExp('done dumping `' + dbName + '\\.([a-zA-Z0-9_]+)` \\((\\d+) documents\\)', 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(output)) !== null) {
    counts[match[1]] = parseInt(match[2], 10);
  }
  return counts;
}

export function idString(value: unknown): string {
  if (value instanceof ObjectId) return value.toHexString();
  if (value && typeof value === 'object' && 'toHexString' in value) {
    return (value as ObjectId).toHexString();
  }
  return String(value);
}

export function normalizeValue(value: unknown): unknown {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object' && !(value instanceof Buffer)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeValue(v);
    }
    return out;
  }
  return value;
}


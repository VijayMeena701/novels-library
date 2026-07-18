/**
 * Backup a MongoDB database from cloud to local.
 *
 * Usage:
 *   tsx backup.ts --source <cloud-uri> --out <dir>
 */
import process from 'node:process';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from '../../src/config/index';
import {
  log,
  errorExit,
  redactUri,
  ensureDir,
  resolveBinary,
  binaryExists,
  runCommand,
  parseMetadataSummary,
  writeJson,
} from './common';
import { exportAtlasApp } from './atlas-app-export';

function printUsage(): void {
  console.log(`
Backup a MongoDB cloud database to local storage.

Usage:
  tsx backup.ts [options]

Options:
  -s, --source, --uri <uri>   Cloud MongoDB connection string (or SOURCE_MONGODB_URI)
  -o, --out <dir>             Backup output directory (or BACKUP_DIR)
  -d, --db <name>             Dump a single database (or BACKUP_DATABASE)
      --tools-dir <dir>       Directory containing mongodump.exe (or MONGODB_TOOLS_DIR)
      --include-atlas         Also export Atlas App Services config (triggers/functions)
      --dump-users            Also dump users/roles for the selected database
      --ns-include <ns>       Include namespace (can be repeated; e.g. db.coll or db.*)
      --ns-exclude <ns>       Exclude namespace (can be repeated)
  -h, --help                  Show this help
`);
}

interface BackupArgs {
  source?: string;
  uri?: string;
  out?: string;
  db?: string;
  'tools-dir'?: string;
  'include-atlas'?: boolean;
  'dump-users'?: boolean;
  'ns-include'?: string[];
  'ns-exclude'?: string[];
  help?: boolean;
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    source: { type: 'string', short: 's' },
    uri: { type: 'string' },
    out: { type: 'string', short: 'o' },
    db: { type: 'string', short: 'd' },
    'tools-dir': { type: 'string' },
    'include-atlas': { type: 'boolean' },
    'dump-users': { type: 'boolean' },
    'ns-include': { type: 'string', multiple: true },
    'ns-exclude': { type: 'string', multiple: true },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
}) as { values: BackupArgs };

if (values.help) {
  printUsage();
  process.exit(0);
}

const source = values.uri || values.source || config.sourceMongodbUri;
if (!source) {
  printUsage();
  errorExit('SOURCE_MONGODB_URI is required. Provide --source / --uri or set it in config.');
}

const dbName = values.db || config.backupDatabase;
const backupDir = resolve(values.out || config.backupDir || defaultBackupDir());
const toolsDir = values['tools-dir'] || config.mongodbToolsDir;
const includeAtlas = values['include-atlas'] || config.includeAtlas;
const dumpUsers = values['dump-users'] || config.dumpUsers;

if (dumpUsers && !dbName) {
  errorExit(
    '--dump-users requires --db / BACKUP_DATABASE (or backupDatabase in config) because users/roles are dumped per database.',
  );
}

const mongodump = resolveBinary('mongodump', toolsDir);
if (!(await binaryExists(mongodump))) {
  errorExit(`mongodump not found: ${mongodump}. Install MongoDB Database Tools or set MONGODB_TOOLS_DIR.`);
}

await ensureDir(join(backupDir, 'data'));
log(`Starting backup of ${redactUri(source)}`);
log(`Backup directory: ${backupDir}`);

const dumpArgs: string[] = ['--uri', source, '--out', join(backupDir, 'data'), '--gzip'];
if (dbName) {
  dumpArgs.push('--db', dbName);
}
if (dumpUsers) {
  dumpArgs.push('--dumpDbUsersAndRoles');
}

const nsInclude = values['ns-include'] || [];
const nsExclude = values['ns-exclude'] || [];
nsInclude.forEach((ns) => dumpArgs.push('--nsInclude', ns));
nsExclude.forEach((ns) => dumpArgs.push('--nsExclude', ns));

await runCommand(mongodump, dumpArgs);

log('Extracting collection schemas, validation rules and indexes from metadata...');
const summary = await parseMetadataSummary(backupDir);
await writeJson(join(backupDir, 'metadata', 'summary.json'), summary);

const backupInfo = {
  source: redactUri(source),
  backupDir,
  database: dbName || null,
  dumpedAt: new Date().toISOString(),
  dumpCommand: { binary: mongodump, args: dumpArgs },
};
await writeJson(join(backupDir, 'backup-info.json'), backupInfo);

if (includeAtlas) {
  try {
    await exportAtlasApp(backupDir);
  } catch (err) {
    log('Atlas app export failed (optional):', err instanceof Error ? err.message : err);
    log('Set atlasPublicKey / atlasPrivateKey / atlasGroupId / atlasAppId in config to enable it.');
  }
}

log('Backup complete:', backupDir);

function defaultBackupDir(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `mongodb-backups/${ts}`;
}

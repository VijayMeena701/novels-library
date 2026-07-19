/**
 * Restore a MongoDB backup created by backup.ts.
 *
 * Usage:
 *   tsx restore.ts --target <local-uri> --backup <dir>
 */
import process from 'node:process';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from '../../src/config/index';
import { log, errorExit, redactUri, resolveBinary, binaryExists, runCommand, readJson } from './common';

function printUsage(): void {
  console.log(`
Restore a MongoDB backup to a local (or any target) MongoDB server.

Usage:
  tsx restore.ts [options]

Options:
  -t, --target, --uri <uri>  Target MongoDB connection string (or TARGET_MONGODB_URI)
  -b, --backup <dir>         Backup directory created by backup.ts (or BACKUP_DIR)
      --drop                 Drop existing collections before restoring (or RESTORE_DROP=true)
      --stop-on-error        Stop on first restore error
      --ns-include <ns>      Restore only matching namespace (can be repeated)
      --ns-exclude <ns>      Skip matching namespace (can be repeated)
      --ns-from <pattern>    Rename namespace from pattern (use with --ns-to)
      --ns-to <pattern>      Rename namespace to pattern
      --tools-dir <dir>      Directory containing mongorestore.exe (or MONGODB_TOOLS_DIR)
  -h, --help                 Show this help
`);
}

interface RestoreArgs {
  target?: string;
  uri?: string;
  backup?: string;
  drop?: boolean;
  'stop-on-error'?: boolean;
  'ns-include'?: string[];
  'ns-exclude'?: string[];
  'ns-from'?: string;
  'ns-to'?: string;
  'tools-dir'?: string;
  help?: boolean;
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    target: { type: 'string', short: 't' },
    uri: { type: 'string' },
    backup: { type: 'string', short: 'b' },
    drop: { type: 'boolean' },
    'stop-on-error': { type: 'boolean' },
    'ns-include': { type: 'string', multiple: true },
    'ns-exclude': { type: 'string', multiple: true },
    'ns-from': { type: 'string' },
    'ns-to': { type: 'string' },
    'tools-dir': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
}) as { values: RestoreArgs };

if (values.help) {
  printUsage();
  process.exit(0);
}

const target = values.uri || values.target || config.targetMongodbUri;
const backupDir = values.backup || config.backupDir;
if (!target) {
  printUsage();
  errorExit('TARGET_MONGODB_URI is required. Provide --target / --uri or set it in config.');
}
if (!backupDir) {
  printUsage();
  errorExit('Backup directory is required. Provide --backup or set BACKUP_DIR in config.');
}

const toolsDir = values['tools-dir'] || config.mongodbToolsDir;
const drop = values.drop || config.restoreDrop;

const mongorestore = resolveBinary('mongorestore', toolsDir);
if (!(await binaryExists(mongorestore))) {
  errorExit(`mongorestore not found: ${mongorestore}. Install MongoDB Database Tools or set MONGODB_TOOLS_DIR.`);
}

const dataDir = resolve(join(backupDir, 'data'));
try {
  const info = (await readJson(join(backupDir, 'backup-info.json'))) as { dumpedAt?: string };
  log(`Restoring backup from ${info.dumpedAt} to ${redactUri(target)}`);
} catch {
  log(`Restoring backup from ${backupDir} to ${redactUri(target)}`);
}

const restoreArgs: string[] = ['--uri', target, '--dir', dataDir, '--gzip'];
if (drop) {
  restoreArgs.push('--drop');
}
if (drop || values['stop-on-error'] || config.restoreStopOnError) {
  restoreArgs.push('--stopOnError');
}

const nsInclude = values['ns-include'] || [];
const nsExclude = values['ns-exclude'] || [];
nsInclude.forEach((ns) => restoreArgs.push('--nsInclude', ns));
nsExclude.forEach((ns) => restoreArgs.push('--nsExclude', ns));
if (values['ns-from']) restoreArgs.push('--nsFrom', values['ns-from']);
if (values['ns-to']) restoreArgs.push('--nsTo', values['ns-to']);

await runCommand(mongorestore, restoreArgs);

log('Restore complete.');

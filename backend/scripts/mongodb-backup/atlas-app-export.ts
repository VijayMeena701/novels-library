/**
 * Optional Atlas App Services export (triggers, functions, etc.).
 * Called by backup.ts when --include-atlas is set.
 */
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { config } from '../../src/config/index';
import { log, ensureDir, resolveBinary, captureOutput, runCommand } from './common';

const ADMIN_BASE = 'https://services.cloud.mongodb.com/api/admin/v3.0';

interface AtlasCreds {
  publicKey?: string;
  privateKey?: string;
  groupId?: string;
  appId?: string;
  internalAppId?: string;
}

export async function exportAtlasApp(backupDir: string, opts: AtlasCreds = {}): Promise<void> {
  const publicKey = opts.publicKey || config.atlasPublicKey;
  const privateKey = opts.privateKey || config.atlasPrivateKey;
  const groupId = opts.groupId || config.atlasGroupId;
  const appId = opts.appId || config.atlasAppId;
  const internalAppId = opts.internalAppId || config.atlasAppInternalId;

  if (!publicKey || !privateKey || !groupId || !appId) {
    log('Atlas App Services export skipped: set atlasPublicKey, atlasPrivateKey, atlasGroupId, atlasAppId in config.');
    return;
  }

  const atlasDir = join(backupDir, 'atlas-app');
  await ensureDir(atlasDir);

  // Try the App Services CLI first (pulls readable, version-controlled config files)
  try {
    const cli = resolveBinary('appservices', config.appServicesDir);
    await captureOutput(cli, ['--version']);
    log('Found appservices CLI, exporting Atlas App Services config...');
    await runCommand(cli, ['login', '--api-key', publicKey, '--private-api-key', privateKey]);
    const localPath = join(atlasDir, 'app-config');
    await runCommand(cli, ['pull', '--remote', appId, '--local', localPath, '--include-dependencies']);
    log('Atlas App Services config saved to', localPath);
    return;
  } catch (err) {
    log(
      'appservices CLI not available or failed, trying Admin API fallback:',
      err instanceof Error ? err.message : err,
    );
  }

  // Fallback: export the app as a ZIP via the Admin API
  try {
    log('Authenticating to Atlas App Services Admin API...');
    const token = await getAccessToken(publicKey, privateKey);
    const resolvedAppId = internalAppId || (await findAppId(groupId, token, appId));
    log('Exporting Atlas App Services app via Admin API...');
    const buffer = await exportAppZip(groupId, resolvedAppId, token);
    const zipPath = join(atlasDir, 'app-export.zip');
    await writeFile(zipPath, Buffer.from(buffer));
    log('Atlas App Services export saved to', zipPath);
    log('Extract the zip to view triggers/functions, or restore via appservices push / App Services UI.');
  } catch (err) {
    throw new Error(`Atlas App Services export failed: ${err instanceof Error ? err.message : err}`);
  }
}

interface AtlasLoginResponse {
  access_token: string;
}

async function getAccessToken(publicKey: string, privateKey: string): Promise<string> {
  const res = await fetch(`${ADMIN_BASE}/auth/providers/mongodb-cloud/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: publicKey, apiKey: privateKey }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as AtlasLoginResponse;
  return data.access_token;
}

interface AtlasApp {
  _id: string;
  client_app_id?: string;
  name?: string;
}

async function findAppId(groupId: string, token: string, appId: string): Promise<string> {
  const res = await fetch(`${ADMIN_BASE}/groups/${groupId}/apps`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List apps failed: ${res.status} ${text}`);
  }
  const apps = (await res.json()) as AtlasApp[];
  const app = apps.find((a) => a.client_app_id === appId || a.name === appId || a._id === appId);
  if (!app) {
    throw new Error(
      `Atlas app not found: ${appId}. Available apps: ${apps.map((a) => a.client_app_id || a.name).join(', ')}`,
    );
  }
  return app._id;
}

async function exportAppZip(groupId: string, appId: string, token: string): Promise<ArrayBuffer> {
  const res = await fetch(`${ADMIN_BASE}/groups/${groupId}/apps/${appId}/export`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/zip' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Export failed: ${res.status} ${text}`);
  }
  return await res.arrayBuffer();
}

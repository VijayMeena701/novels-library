import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main() {
  const mongod = await MongoMemoryServer.create();

  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-jwt-secret';
  process.env.ADMIN_EMAILS = process.env.ADMIN_EMAILS || 'admin@example.com';
  process.env.NODE_ENV = 'production';

  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../backend');
  const backend = spawn('npm', ['run', 'dev'], {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  const cleanup = async () => {
    backend.kill('SIGTERM');
    await mongod.stop();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  backend.on('exit', async () => {
    await mongod.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

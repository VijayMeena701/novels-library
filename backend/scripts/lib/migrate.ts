import { log } from './mongodb-tools.js';

export async function runMigrations(db: any): Promise<void> {
  log('Database is in steady state. All legacy, terminology, and RBAC migrations have been retired.');
}

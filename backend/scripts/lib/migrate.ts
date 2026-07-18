import { log } from './mongodb-tools.js';
import { runLegacyMigration } from '../../migrations/legacy.js';
import { renameChapterTerminology } from '../../migrations/001-unit-to-chapter.js';
import { renameRbacTerminology } from '../../migrations/002-rbac-unit-to-chapter.js';

async function recordMarker(db: any, name: string): Promise<void> {
  await db.collection('migrations').updateOne(
    { name },
    { $set: { name, completedAt: new Date() } },
    { upsert: true },
  );
}

export async function runMigrations(db: any): Promise<void> {
  log('Running migration: legacy');
  await runLegacyMigration(db, false);
  await recordMarker(db, 'legacy');
  log('Completed migration: legacy');

  log('Running migration: unit-to-chapter');
  await renameChapterTerminology(db, false);
  await recordMarker(db, 'unit-to-chapter');
  log('Completed migration: unit-to-chapter');

  log('Running migration: rbac-unit-to-chapter');
  await renameRbacTerminology(db, false);
  await recordMarker(db, 'rbac-unit-to-chapter');
  log('Completed migration: rbac-unit-to-chapter');
}

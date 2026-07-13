/// <reference types="node" />
import 'dotenv/config';
import mongoose from 'mongoose';

type MongoDb = any;

interface MigrationCounts {
  before: Record<string, number>;
  conflicts: Record<string, number>;
  orphans: Record<string, number>;
  afterCopy?: Record<string, number>;
  afterUnset?: Record<string, number>;
}

async function countExists(db: MongoDb, collection: string, filter: any): Promise<number> {
  return db.collection(collection).countDocuments(filter);
}

async function getOrphanCounts(db: MongoDb): Promise<Record<string, number>> {
  const [books, users] = await Promise.all([
    db
      .collection('books')
      .find({}, { projection: { _id: 1 } })
      .toArray(),
    db
      .collection('users')
      .find({}, { projection: { _id: 1 } })
      .toArray(),
  ]);
  const bookIds = new Set(books.map((b: any) => b._id.toString()));
  const userIds = new Set(users.map((u: any) => u._id.toString()));

  const bookIdObjectIds = [...bookIds].map((id) => new mongoose.Types.ObjectId(id as string));
  const userIdObjectIds = [...userIds].map((id) => new mongoose.Types.ObjectId(id as string));

  const collectionsWithBookId = [
    'bookcontents',
    'rawbookcontents',
    'bookvisits',
    'bookactivities',
    'bookstats',
    'readingsessions',
    'backgroundjobs',
    'userbooks',
  ];
  const collectionsWithUserId = ['bookvisits', 'bookactivities', 'readingsessions', 'backgroundjobs', 'userbooks'];

  const orphanCounts: Record<string, number> = {};
  for (const coll of collectionsWithBookId) {
    const orphanBook = await countExists(db, coll, { bookId: { $nin: bookIdObjectIds } });
    const orphanUser = collectionsWithUserId.includes(coll)
      ? await countExists(db, coll, { userId: { $exists: true, $nin: userIdObjectIds } })
      : 0;
    orphanCounts[coll] = orphanBook + orphanUser;
  }
  return orphanCounts;
}

async function preflightAndConflictCounts(db: MongoDb): Promise<MigrationCounts> {
  const before: Record<string, number> = {};
  const conflicts: Record<string, number> = {};

  // Books
  before['books.rawUnitsList'] = await countExists(db, 'books', { rawUnitsList: { $exists: true } });
  before['books.rawUnitsTotal'] = await countExists(db, 'books', { rawUnitsTotal: { $exists: true } });
  before['books.translatedUnitsList'] = await countExists(db, 'books', { translatedUnitsList: { $exists: true } });
  before['books.translatedUnitsTotal'] = await countExists(db, 'books', { translatedUnitsTotal: { $exists: true } });

  conflicts['books.rawUnitsList+rawChaptersList'] = await countExists(db, 'books', {
    rawUnitsList: { $exists: true },
    rawChaptersList: { $exists: true },
    $expr: { $ne: ['$rawUnitsList', '$rawChaptersList'] },
  });
  conflicts['books.rawUnitsTotal+rawChaptersTotal'] = await countExists(db, 'books', {
    rawUnitsTotal: { $exists: true },
    rawChaptersTotal: { $exists: true },
    $expr: { $ne: ['$rawUnitsTotal', '$rawChaptersTotal'] },
  });
  conflicts['books.translatedUnitsList+translatedChaptersList'] = await countExists(db, 'books', {
    translatedUnitsList: { $exists: true },
    translatedChaptersList: { $exists: true },
    $expr: { $ne: ['$translatedUnitsList', '$translatedChaptersList'] },
  });
  conflicts['books.translatedUnitsTotal+translatedChaptersTotal'] = await countExists(db, 'books', {
    translatedUnitsTotal: { $exists: true },
    translatedChaptersTotal: { $exists: true },
    $expr: { $ne: ['$translatedUnitsTotal', '$translatedChaptersTotal'] },
  });

  // User progress
  before['userbooks.unitsRead'] = await countExists(db, 'userbooks', { unitsRead: { $exists: true } });
  before['userbooks.lastVisitedUnitNumber'] = await countExists(db, 'userbooks', {
    lastVisitedUnitNumber: { $exists: true },
  });
  conflicts['userbooks.unitsRead+chaptersRead'] = await countExists(db, 'userbooks', {
    unitsRead: { $exists: true },
    chaptersRead: { $exists: true },
    $expr: { $ne: ['$unitsRead', '$chaptersRead'] },
  });
  conflicts['userbooks.lastVisitedUnitNumber+lastVisitedChapterNumber'] = await countExists(db, 'userbooks', {
    lastVisitedUnitNumber: { $exists: true },
    lastVisitedChapterNumber: { $exists: true },
    $expr: { $ne: ['$lastVisitedUnitNumber', '$lastVisitedChapterNumber'] },
  });

  // Reading sessions
  before['readingsessions.unitsRead'] = await countExists(db, 'readingsessions', { unitsRead: { $exists: true } });
  conflicts['readingsessions.unitsRead+chaptersRead'] = await countExists(db, 'readingsessions', {
    unitsRead: { $exists: true },
    chaptersRead: { $exists: true },
    $expr: { $ne: ['$unitsRead', '$chaptersRead'] },
  });

  // Book stats
  before['bookstats.totalUnitsRead'] = await countExists(db, 'bookstats', { totalUnitsRead: { $exists: true } });
  conflicts['bookstats.totalUnitsRead+totalChaptersRead'] = await countExists(db, 'bookstats', {
    totalUnitsRead: { $exists: true },
    totalChaptersRead: { $exists: true },
    $expr: { $ne: ['$totalUnitsRead', '$totalChaptersRead'] },
  });

  // Chapter content
  before['bookcontents.unitNumber'] = await countExists(db, 'bookcontents', { unitNumber: { $exists: true } });
  before['bookcontents.unitType'] = await countExists(db, 'bookcontents', { unitType: { $exists: true } });
  conflicts['bookcontents.unitNumber+chapterNumber'] = await countExists(db, 'bookcontents', {
    unitNumber: { $exists: true },
    chapterNumber: { $exists: true },
    $expr: { $ne: ['$unitNumber', '$chapterNumber'] },
  });
  conflicts['bookcontents.unitType+chapterType'] = await countExists(db, 'bookcontents', {
    unitType: { $exists: true },
    chapterType: { $exists: true },
    $expr: { $ne: ['$unitType', '$chapterType'] },
  });

  // Raw chapter content
  before['rawbookcontents.unitNumber'] = await countExists(db, 'rawbookcontents', { unitNumber: { $exists: true } });
  before['rawbookcontents.unitType'] = await countExists(db, 'rawbookcontents', { unitType: { $exists: true } });
  conflicts['rawbookcontents.unitNumber+chapterNumber'] = await countExists(db, 'rawbookcontents', {
    unitNumber: { $exists: true },
    chapterNumber: { $exists: true },
    $expr: { $ne: ['$unitNumber', '$chapterNumber'] },
  });
  conflicts['rawbookcontents.unitType+chapterType'] = await countExists(db, 'rawbookcontents', {
    unitType: { $exists: true },
    chapterType: { $exists: true },
    $expr: { $ne: ['$unitType', '$chapterType'] },
  });

  // Visits
  before['bookvisits.unitNumber'] = await countExists(db, 'bookvisits', { unitNumber: { $exists: true } });
  before['bookvisits.unitType'] = await countExists(db, 'bookvisits', { unitType: { $exists: true } });
  before['bookvisits.unitTitle'] = await countExists(db, 'bookvisits', { unitTitle: { $exists: true } });
  conflicts['bookvisits.unitNumber+chapterNumber'] = await countExists(db, 'bookvisits', {
    unitNumber: { $exists: true },
    chapterNumber: { $exists: true },
    $expr: { $ne: ['$unitNumber', '$chapterNumber'] },
  });
  conflicts['bookvisits.unitType+chapterType'] = await countExists(db, 'bookvisits', {
    unitType: { $exists: true },
    chapterType: { $exists: true },
    $expr: { $ne: ['$unitType', '$chapterType'] },
  });
  conflicts['bookvisits.unitTitle+chapterTitle'] = await countExists(db, 'bookvisits', {
    unitTitle: { $exists: true },
    chapterTitle: { $exists: true },
    $expr: { $ne: ['$unitTitle', '$chapterTitle'] },
  });

  // Activities
  before['bookactivities.unitType'] = await countExists(db, 'bookactivities', { unitType: { $exists: true } });
  before['bookactivities.unitNumber'] = await countExists(db, 'bookactivities', { unitNumber: { $exists: true } });
  before['bookactivities.unitTitle'] = await countExists(db, 'bookactivities', { unitTitle: { $exists: true } });
  conflicts['bookactivities.unitType+chapterType'] = await countExists(db, 'bookactivities', {
    unitType: { $exists: true },
    chapterType: { $exists: true },
    $expr: { $ne: ['$unitType', '$chapterType'] },
  });
  conflicts['bookactivities.unitNumber+chapterNumber'] = await countExists(db, 'bookactivities', {
    unitNumber: { $exists: true },
    chapterNumber: { $exists: true },
    $expr: { $ne: ['$unitNumber', '$chapterNumber'] },
  });
  conflicts['bookactivities.unitTitle+chapterTitle'] = await countExists(db, 'bookactivities', {
    unitTitle: { $exists: true },
    chapterTitle: { $exists: true },
    $expr: { $ne: ['$unitTitle', '$chapterTitle'] },
  });

  // Background jobs
  before['backgroundjobs.type.scrape_units'] = await countExists(db, 'backgroundjobs', { type: 'scrape_units' });
  before['backgroundjobs.type.scrape_raw_units'] = await countExists(db, 'backgroundjobs', {
    type: 'scrape_raw_units',
  });
  before['backgroundjobs.error.unitNumber'] = await countExists(db, 'backgroundjobs', {
    'error.unitNumber': { $exists: true },
  });
  conflicts['backgroundjobs.error.unitNumber+chapterNumber'] = await countExists(db, 'backgroundjobs', {
    'error.unitNumber': { $exists: true },
    'error.chapterNumber': { $exists: true },
    $expr: { $ne: ['$error.unitNumber', '$error.chapterNumber'] },
  });

  const orphans = await getOrphanCounts(db);

  return { before, conflicts, orphans };
}

async function ensureIndexes(db: MongoDb, dryRun: boolean): Promise<void> {
  const required: { collection: string; keys: any; options: any }[] = [
    { collection: 'bookcontents', keys: { bookId: 1, chapterNumber: 1 }, options: { unique: true, background: true } },
    {
      collection: 'rawbookcontents',
      keys: { bookId: 1, chapterNumber: 1 },
      options: { unique: true, background: true },
    },
  ];

  for (const { collection, keys, options } of required) {
    if (dryRun) {
      console.log(`[dry-run] would ensure index on ${collection}: ${JSON.stringify(keys)}`);
      continue;
    }
    try {
      await db.collection(collection).createIndex(keys, options);
      console.log(`Ensured index on ${collection}: ${JSON.stringify(keys)}`);
    } catch (err: any) {
      throw new Error(`Failed to ensure index on ${collection}: ${err.message}`);
    }
  }
}

async function dropOldUnitIndexes(db: MongoDb, dryRun: boolean): Promise<void> {
  const collections = ['bookcontents', 'rawbookcontents'];
  for (const coll of collections) {
    const indexes = await db.collection(coll).indexes();
    for (const index of indexes) {
      const key = index.key || {};
      if (Object.keys(key).some((k) => k.includes('unitNumber'))) {
        if (dryRun) {
          console.log(`[dry-run] would drop old index ${index.name} on ${coll}`);
        } else {
          try {
            await db.collection(coll).dropIndex(index.name);
            console.log(`Dropped old index ${index.name} on ${coll}`);
          } catch (err: any) {
            if (err.code !== 27 && err.codeName !== 'IndexNotFound') {
              throw new Error(`Failed to drop old index ${index.name} on ${coll}: ${err.message}`);
            }
          }
        }
      }
    }
  }
}

async function renameScalarField(
  db: MongoDb,
  collection: string,
  oldField: string,
  newField: string,
  dryRun: boolean,
): Promise<void> {
  const filter = { [oldField]: { $exists: true } };
  if (dryRun) {
    console.log(`[dry-run] would copy ${collection}.${oldField} -> ${collection}.${newField}`);
    return;
  }
  await db.collection(collection).updateMany(filter, [{ $set: { [newField]: `$${oldField}` } }]);
  console.log(`Copied ${collection}.${oldField} -> ${collection}.${newField}`);
}

async function unsetScalarField(db: MongoDb, collection: string, oldField: string, dryRun: boolean): Promise<void> {
  const filter = { [oldField]: { $exists: true } };
  if (dryRun) {
    console.log(`[dry-run] would unset ${collection}.${oldField}`);
    return;
  }
  await db.collection(collection).updateMany(filter, { $unset: { [oldField]: '' } });
  console.log(`Unset ${collection}.${oldField}`);
}

async function renameBookLists(db: MongoDb, dryRun: boolean): Promise<void> {
  const listFields = [
    { oldList: 'rawUnitsList', oldTotal: 'rawUnitsTotal', newList: 'rawChaptersList', newTotal: 'rawChaptersTotal' },
    {
      oldList: 'translatedUnitsList',
      oldTotal: 'translatedUnitsTotal',
      newList: 'translatedChaptersList',
      newTotal: 'translatedChaptersTotal',
    },
  ];

  for (const { oldList, oldTotal, newList, newTotal } of listFields) {
    const filter = { $or: [{ [oldList]: { $exists: true } }, { [oldTotal]: { $exists: true } }] };
    if (dryRun) {
      console.log(`[dry-run] would copy books.${oldList}/${oldTotal} -> books.${newList}/${newTotal}`);
      continue;
    }
    await db.collection('books').updateMany(filter, [
      {
        $set: {
          [newList]: {
            $cond: {
              if: { $isArray: `$${oldList}` },
              then: {
                $map: {
                  input: `$${oldList}`,
                  in: {
                    title: '$$this.title',
                    url: '$$this.url',
                    chapterNumber: '$$this.unitNumber',
                    chapterType: { $ifNull: ['$$this.unitType', 'chapter'] },
                  },
                },
              },
              else: { $ifNull: [`$${newList}`, []] },
            },
          },
          [newTotal]: {
            $cond: {
              if: { $isArray: `$${oldList}` },
              then: { $ifNull: [`$${oldTotal}`, { $size: `$${oldList}` }] },
              else: { $ifNull: [`$${oldTotal}`, { $ifNull: [`$${newTotal}`, 0] }] },
            },
          },
        },
      },
    ]);
    console.log(`Copied books.${oldList}/${oldTotal} -> books.${newList}/${newTotal}`);
  }
}

async function unsetBookLists(db: MongoDb, dryRun: boolean): Promise<void> {
  const listFields = [
    { oldList: 'rawUnitsList', oldTotal: 'rawUnitsTotal' },
    { oldList: 'translatedUnitsList', oldTotal: 'translatedUnitsTotal' },
  ];

  for (const { oldList, oldTotal } of listFields) {
    const filter = { $or: [{ [oldList]: { $exists: true } }, { [oldTotal]: { $exists: true } }] };
    if (dryRun) {
      console.log(`[dry-run] would unset books.${oldList}/${oldTotal}`);
      continue;
    }
    await db.collection('books').updateMany(filter, { $unset: { [oldList]: '', [oldTotal]: '' } });
    console.log(`Unset books.${oldList}/${oldTotal}`);
  }
}

async function renameBackgroundJobTypes(db: MongoDb, dryRun: boolean): Promise<void> {
  const renames: { old: string; new: string }[] = [
    { old: 'scrape_units', new: 'scrape_chapters' },
    { old: 'scrape_raw_units', new: 'scrape_raw_chapters' },
  ];
  for (const { old, new: newValue } of renames) {
    if (dryRun) {
      console.log(`[dry-run] would update backgroundjobs.type ${old} -> ${newValue}`);
      continue;
    }
    const result = await db.collection('backgroundjobs').updateMany({ type: old }, { $set: { type: newValue } });
    console.log(`Updated backgroundjobs.type ${old} -> ${newValue}: ${result.modifiedCount} docs`);
  }
}

async function copyErrorField(db: MongoDb, dryRun: boolean): Promise<void> {
  const filter = { 'error.unitNumber': { $exists: true } };
  if (dryRun) {
    console.log('[dry-run] would copy backgroundjobs.error.unitNumber -> backgroundjobs.error.chapterNumber');
    return;
  }
  await db.collection('backgroundjobs').updateMany(filter, [{ $set: { 'error.chapterNumber': '$error.unitNumber' } }]);
  console.log('Copied backgroundjobs.error.unitNumber -> backgroundjobs.error.chapterNumber');
}

async function unsetErrorField(db: MongoDb, dryRun: boolean): Promise<void> {
  const filter = { 'error.unitNumber': { $exists: true } };
  if (dryRun) {
    console.log('[dry-run] would unset backgroundjobs.error.unitNumber');
    return;
  }
  await db.collection('backgroundjobs').updateMany(filter, { $unset: { 'error.unitNumber': '' } });
  console.log('Unset backgroundjobs.error.unitNumber');
}

function logCounts(label: string, counts: Record<string, number>): void {
  console.log(`\n${label}:`);
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key}: ${value}`);
  }
}

function anyConflicts(conflicts: Record<string, number>): string[] {
  return Object.entries(conflicts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key} (${count})`);
}

async function verifyCopy(db: MongoDb, before: Record<string, number>, after: Record<string, number>): Promise<void> {
  const errors: string[] = [];

  const expectedAfter: Record<string, number> = {
    'books.rawChaptersList':
      before['books.rawUnitsList'] +
      before['books.rawUnitsTotal'] -
      (await countExists(db, 'books', { rawUnitsList: { $exists: true }, rawUnitsTotal: { $exists: true } })),
    'books.rawChaptersTotal':
      before['books.rawUnitsList'] +
      before['books.rawUnitsTotal'] -
      (await countExists(db, 'books', { rawUnitsList: { $exists: true }, rawUnitsTotal: { $exists: true } })),
    'books.translatedChaptersList':
      before['books.translatedUnitsList'] +
      before['books.translatedUnitsTotal'] -
      (await countExists(db, 'books', {
        translatedUnitsList: { $exists: true },
        translatedUnitsTotal: { $exists: true },
      })),
    'books.translatedChaptersTotal':
      before['books.translatedUnitsList'] +
      before['books.translatedUnitsTotal'] -
      (await countExists(db, 'books', {
        translatedUnitsList: { $exists: true },
        translatedUnitsTotal: { $exists: true },
      })),
  };
  // The counts above are approximate if both list and total exist for the same doc; if they do, the new list/total count is the number of docs in the OR filter.
  // For simplicity, the verification checks that the new fields exist on at least as many documents as the old field counts.
  // Real verification is done in the unset step where old field counts go to 0.
  for (const [key, value] of Object.entries(expectedAfter)) {
    const actual = after[key] ?? 0;
    if (actual < value) {
      errors.push(`${key}: expected at least ${value}, got ${actual}`);
    }
  }

  const simpleMappings: { before: string; after: string }[] = [
    { before: 'userbooks.unitsRead', after: 'userbooks.chaptersRead' },
    { before: 'userbooks.lastVisitedUnitNumber', after: 'userbooks.lastVisitedChapterNumber' },
    { before: 'readingsessions.unitsRead', after: 'readingsessions.chaptersRead' },
    { before: 'bookstats.totalUnitsRead', after: 'bookstats.totalChaptersRead' },
    { before: 'bookcontents.unitNumber', after: 'bookcontents.chapterNumber' },
    { before: 'bookcontents.unitType', after: 'bookcontents.chapterType' },
    { before: 'rawbookcontents.unitNumber', after: 'rawbookcontents.chapterNumber' },
    { before: 'rawbookcontents.unitType', after: 'rawbookcontents.chapterType' },
    { before: 'bookvisits.unitNumber', after: 'bookvisits.chapterNumber' },
    { before: 'bookvisits.unitType', after: 'bookvisits.chapterType' },
    { before: 'bookvisits.unitTitle', after: 'bookvisits.chapterTitle' },
    { before: 'bookactivities.unitType', after: 'bookactivities.chapterType' },
    { before: 'bookactivities.unitNumber', after: 'bookactivities.chapterNumber' },
    { before: 'bookactivities.unitTitle', after: 'bookactivities.chapterTitle' },
    { before: 'backgroundjobs.error.unitNumber', after: 'backgroundjobs.error.chapterNumber' },
  ];
  for (const { before: bKey, after: aKey } of simpleMappings) {
    const expected = before[bKey] ?? 0;
    const actual = after[aKey] ?? 0;
    if (actual < expected) {
      errors.push(`${aKey}: expected at least ${expected}, got ${actual}`);
    }
  }

  if (errors.length) {
    throw new Error(`Verification after copy failed:\n${errors.join('\n')}`);
  }
}

async function verifyUnset(db: MongoDb, before: Record<string, number>): Promise<void> {
  const errors: string[] = [];
  const oldFields: { collection: string; field: string }[] = [
    { collection: 'books', field: 'rawUnitsList' },
    { collection: 'books', field: 'rawUnitsTotal' },
    { collection: 'books', field: 'translatedUnitsList' },
    { collection: 'books', field: 'translatedUnitsTotal' },
    { collection: 'userbooks', field: 'unitsRead' },
    { collection: 'userbooks', field: 'lastVisitedUnitNumber' },
    { collection: 'readingsessions', field: 'unitsRead' },
    { collection: 'bookstats', field: 'totalUnitsRead' },
    { collection: 'bookcontents', field: 'unitNumber' },
    { collection: 'bookcontents', field: 'unitType' },
    { collection: 'rawbookcontents', field: 'unitNumber' },
    { collection: 'rawbookcontents', field: 'unitType' },
    { collection: 'bookvisits', field: 'unitNumber' },
    { collection: 'bookvisits', field: 'unitType' },
    { collection: 'bookvisits', field: 'unitTitle' },
    { collection: 'bookactivities', field: 'unitType' },
    { collection: 'bookactivities', field: 'unitNumber' },
    { collection: 'bookactivities', field: 'unitTitle' },
    { collection: 'backgroundjobs', field: 'error.unitNumber' },
  ];

  for (const { collection, field } of oldFields) {
    const remaining = await countExists(
      db,
      collection,
      field.includes('.') ? { [field]: { $exists: true } } : { [field]: { $exists: true } },
    );
    if (remaining > 0) {
      errors.push(`${collection}.${field}: ${remaining} old field(s) remain`);
    }
  }

  const oldJobTypes = await countExists(db, 'backgroundjobs', { type: { $in: ['scrape_units', 'scrape_raw_units'] } });
  if (oldJobTypes > 0) {
    errors.push(`backgroundjobs.type old values: ${oldJobTypes}`);
  }

  if (errors.length) {
    throw new Error(`Verification after unset failed:\n${errors.join('\n')}`);
  }
}

export async function renameChapterTerminology(db: MongoDb, dryRun: boolean): Promise<void> {
  const { before, conflicts, orphans } = await preflightAndConflictCounts(db);
  logCounts('Preflight counts', before);
  logCounts('Conflict counts', conflicts);
  logCounts('Orphan counts', orphans);

  const conflictList = anyConflicts(conflicts);
  if (conflictList.length) {
    throw new Error(`Conflicting source/target fields found:\n${conflictList.join('\n')}`);
  }

  const totalOld = Object.values(before).reduce((a, b) => a + b, 0);
  if (totalOld === 0) {
    console.log('No old chapter terminology fields found. Nothing to migrate.');
    return;
  }

  if (dryRun) {
    console.log('\n[dry-run] No writes performed. Pass without --dry-run to execute.');
    return;
  }

  // Step 1: Copy old data to new fields
  await renameBookLists(db, dryRun);
  await renameScalarField(db, 'userbooks', 'unitsRead', 'chaptersRead', dryRun);
  await renameScalarField(db, 'userbooks', 'lastVisitedUnitNumber', 'lastVisitedChapterNumber', dryRun);
  await renameScalarField(db, 'readingsessions', 'unitsRead', 'chaptersRead', dryRun);
  await renameScalarField(db, 'bookstats', 'totalUnitsRead', 'totalChaptersRead', dryRun);
  await renameScalarField(db, 'bookcontents', 'unitNumber', 'chapterNumber', dryRun);
  await renameScalarField(db, 'bookcontents', 'unitType', 'chapterType', dryRun);
  await renameScalarField(db, 'rawbookcontents', 'unitNumber', 'chapterNumber', dryRun);
  await renameScalarField(db, 'rawbookcontents', 'unitType', 'chapterType', dryRun);
  await renameScalarField(db, 'bookvisits', 'unitNumber', 'chapterNumber', dryRun);
  await renameScalarField(db, 'bookvisits', 'unitType', 'chapterType', dryRun);
  await renameScalarField(db, 'bookvisits', 'unitTitle', 'chapterTitle', dryRun);
  await renameScalarField(db, 'bookactivities', 'unitType', 'chapterType', dryRun);
  await renameScalarField(db, 'bookactivities', 'unitNumber', 'chapterNumber', dryRun);
  await renameScalarField(db, 'bookactivities', 'unitTitle', 'chapterTitle', dryRun);
  await copyErrorField(db, dryRun);

  // Step 2: Update background job type values
  await renameBackgroundJobTypes(db, dryRun);

  // Step 3: Verify copy
  const afterCopy: Record<string, number> = {};
  // Build new-field counts from the same preflight helper (new keys are the new names).
  // For new fields, we query the new names directly.
  afterCopy['books.rawChaptersList'] = await countExists(db, 'books', { rawChaptersList: { $exists: true } });
  afterCopy['books.rawChaptersTotal'] = await countExists(db, 'books', { rawChaptersTotal: { $exists: true } });
  afterCopy['books.translatedChaptersList'] = await countExists(db, 'books', {
    translatedChaptersList: { $exists: true },
  });
  afterCopy['books.translatedChaptersTotal'] = await countExists(db, 'books', {
    translatedChaptersTotal: { $exists: true },
  });
  afterCopy['userbooks.chaptersRead'] = await countExists(db, 'userbooks', { chaptersRead: { $exists: true } });
  afterCopy['userbooks.lastVisitedChapterNumber'] = await countExists(db, 'userbooks', {
    lastVisitedChapterNumber: { $exists: true },
  });
  afterCopy['readingsessions.chaptersRead'] = await countExists(db, 'readingsessions', {
    chaptersRead: { $exists: true },
  });
  afterCopy['bookstats.totalChaptersRead'] = await countExists(db, 'bookstats', {
    totalChaptersRead: { $exists: true },
  });
  afterCopy['bookcontents.chapterNumber'] = await countExists(db, 'bookcontents', { chapterNumber: { $exists: true } });
  afterCopy['bookcontents.chapterType'] = await countExists(db, 'bookcontents', { chapterType: { $exists: true } });
  afterCopy['rawbookcontents.chapterNumber'] = await countExists(db, 'rawbookcontents', {
    chapterNumber: { $exists: true },
  });
  afterCopy['rawbookcontents.chapterType'] = await countExists(db, 'rawbookcontents', {
    chapterType: { $exists: true },
  });
  afterCopy['bookvisits.chapterNumber'] = await countExists(db, 'bookvisits', { chapterNumber: { $exists: true } });
  afterCopy['bookvisits.chapterType'] = await countExists(db, 'bookvisits', { chapterType: { $exists: true } });
  afterCopy['bookvisits.chapterTitle'] = await countExists(db, 'bookvisits', { chapterTitle: { $exists: true } });
  afterCopy['bookactivities.chapterType'] = await countExists(db, 'bookactivities', { chapterType: { $exists: true } });
  afterCopy['bookactivities.chapterNumber'] = await countExists(db, 'bookactivities', {
    chapterNumber: { $exists: true },
  });
  afterCopy['bookactivities.chapterTitle'] = await countExists(db, 'bookactivities', {
    chapterTitle: { $exists: true },
  });
  afterCopy['backgroundjobs.error.chapterNumber'] = await countExists(db, 'backgroundjobs', {
    'error.chapterNumber': { $exists: true },
  });

  await verifyCopy(db, before, afterCopy);
  logCounts('After-copy new-field counts', afterCopy);

  // Step 4: Drop old unit indexes before unsetting fields so the old unique indexes don't block removal
  await dropOldUnitIndexes(db, dryRun);

  // Step 5: Remove old fields
  await unsetBookLists(db, dryRun);
  await unsetScalarField(db, 'userbooks', 'unitsRead', dryRun);
  await unsetScalarField(db, 'userbooks', 'lastVisitedUnitNumber', dryRun);
  await unsetScalarField(db, 'readingsessions', 'unitsRead', dryRun);
  await unsetScalarField(db, 'bookstats', 'totalUnitsRead', dryRun);
  await unsetScalarField(db, 'bookcontents', 'unitNumber', dryRun);
  await unsetScalarField(db, 'bookcontents', 'unitType', dryRun);
  await unsetScalarField(db, 'rawbookcontents', 'unitNumber', dryRun);
  await unsetScalarField(db, 'rawbookcontents', 'unitType', dryRun);
  await unsetScalarField(db, 'bookvisits', 'unitNumber', dryRun);
  await unsetScalarField(db, 'bookvisits', 'unitType', dryRun);
  await unsetScalarField(db, 'bookvisits', 'unitTitle', dryRun);
  await unsetScalarField(db, 'bookactivities', 'unitType', dryRun);
  await unsetScalarField(db, 'bookactivities', 'unitNumber', dryRun);
  await unsetScalarField(db, 'bookactivities', 'unitTitle', dryRun);
  await unsetErrorField(db, dryRun);

  // Step 6: Verify removal
  await verifyUnset(db, before);
  console.log('All old fields and job types successfully removed.');

  // Step 7: Ensure indexes on new chapter fields
  await ensureIndexes(db, dryRun);

  console.log('Unit-to-chapter migration completed.');
}

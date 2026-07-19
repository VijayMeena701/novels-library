import { idString, normalizeValue } from './mongodb-tools.js';
import type { BackupResult, VerifyResult, VerifyMismatches } from './types.js';

const OLD_TO_NEW: Record<string, string> = {
  novels: 'books',
  usernovels: 'userbooks',
  chaptercontents: 'bookcontents',
  rawchaptercontents: 'rawbookcontents',
  chaptervisits: 'bookvisits',
};

// For old->new renamed collections, compare _id directly because legacy now preserves original _id.
const ID_PRESERVED_COLLECTIONS = new Set([
  'novels',
  'chaptercontents',
  'rawchaptercontents',
  'chaptervisits',
  'usernovels',
]);

const ALLOW_EXTRA = new Set([
  'actions',
  'resources',
  'capabilities',
  'accessgroups',
  'roles',
  'migrations',
  'genres',
  'publicationstatuses',
  'authors',
  'bookrequests',
]);

// RBAC constant collections are expected to be updated by the seed step.
const SEED_MANAGED = new Set([
  'actions',
  'resources',
  'capabilities',
  'accessgroups',
  'roles',
]);

const UNIT_TO_CHAPTER_FIELDS: Record<string, string> = {
  unitNumber: 'chapterNumber',
  unitType: 'chapterType',
  unitTitle: 'chapterTitle',
  unitsRead: 'chaptersRead',
  totalUnitsRead: 'totalChaptersRead',
  lastVisitedUnitNumber: 'lastVisitedChapterNumber',
  scrape_units: 'scrape_chapters',
  scrape_raw_units: 'scrape_raw_chapters',
  rawUnitsList: 'rawChaptersList',
  rawUnitsTotal: 'rawChaptersTotal',
  translatedUnitsList: 'translatedChaptersList',
  translatedUnitsTotal: 'translatedChaptersTotal',
};

function omitKeys(doc: any, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (keys.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

function normalizeUnitToChapter(doc: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const consumed = new Set<string>();

  for (const [k, v] of Object.entries(doc)) {
    if (k === '_id' || k === 'createdAt' || k === 'updatedAt' || k === '__v') continue;
    const mapped = UNIT_TO_CHAPTER_FIELDS[k];
    if (mapped) {
      if (out[mapped] === undefined) {
        out[mapped] = normalizeValue(v);
      } else {
        out[k] = normalizeValue(v);
      }
      consumed.add(mapped);
    } else {
      out[k] = normalizeValue(v);
    }
  }
  return out;
}

function normalizeChapterArray(list: any[] | undefined): any[] {
  const chapters = (list || []).map((c) => ({
    title: c.title || c.unitTitle || '',
    url: c.url || '',
    chapterNumber: c.unitNumber ?? c.number ?? c.chapterNumber ?? 0,
    chapterType: c.unitType || c.chapterType || 'chapter',
  }));
  chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  return chapters;
}

function normalizeMigratedDoc(
  doc: any,
  collection: string,
  isPre: boolean,
  oldNovelsById?: Map<string, any>,
): Record<string, unknown> {
  const normalized = normalizeUnitToChapter(doc);

  // Map old novelId -> new bookId for migrated child collections.
  if (isPre && (collection === 'chaptercontents' || collection === 'rawchaptercontents' || collection === 'chaptervisits')) {
    const bookId = idString(normalized.novelId ?? normalized.bookId);
    if (bookId && bookId !== 'undefined') {
      normalized.bookId = bookId;
    }
    delete normalized.novelId;
  }
  if (isPre && collection === 'usernovels') {
    const bookId = idString(normalized.novelId ?? normalized.bookId);
    if (bookId && bookId !== 'undefined') {
      normalized.bookId = bookId;
    }
    delete normalized.novelId;
  }

  // For old novels, map chapter lists/totals to the new book shape.
  if (collection === 'novels' || collection === 'books') {
    const translatedList = normalizeChapterArray((normalized.unitsList ?? normalized.chaptersList ?? normalized.translatedChaptersList) as any[] | undefined);
    const rawList = normalizeChapterArray((normalized.rawUnitsList ?? normalized.rawChaptersList ?? normalized.rawChaptersList) as any[] | undefined);
    normalized.translatedChaptersList = translatedList;
    normalized.translatedChaptersTotal =
      normalized.unitsTotal ?? normalized.chaptersTotal ?? normalized.translatedChaptersTotal ?? translatedList.length;
    normalized.rawChaptersList = rawList;
    normalized.rawChaptersTotal =
      normalized.rawUnitsTotal ?? normalized.rawChaptersTotal ?? normalized.rawChaptersTotal ?? rawList.length;
    delete normalized.unitsList;
    delete normalized.chaptersList;
    delete normalized.unitsTotal;
    delete normalized.chaptersTotal;
    delete normalized.rawUnitsList;
    delete normalized.rawChaptersList;
    delete normalized.rawUnitsTotal;
    delete normalized.rawChaptersTotal;
  }
  if (isPre && collection === 'usernovels') {
    normalized.chaptersRead = normalized.chaptersRead ?? normalized.unitsRead;
    normalized.lastVisitedChapterNumber =
      normalized.lastVisitedUnitNumber ?? normalized.lastVisitedChapterNumber ?? normalized.unitsRead ?? normalized.chaptersRead ?? 0;
    delete normalized.unitsRead;
    delete normalized.lastVisitedUnitNumber;
  }
  if (isPre && (collection === 'chaptercontents' || collection === 'rawchaptercontents')) {
    normalized.chapterNumber = normalized.chapterNumber ?? normalized.unitNumber;
    normalized.chapterType = normalized.chapterType ?? normalized.unitType ?? 'chapter';
    normalized.title = normalized.title ?? normalized.unitTitle;
    delete normalized.unitNumber;
    delete normalized.unitType;
    delete normalized.unitTitle;
  }
  if (isPre && collection === 'chaptervisits') {
    normalized.chapterNumber = normalized.chapterNumber ?? normalized.unitNumber;
    normalized.chapterType = normalized.chapterType ?? normalized.unitType ?? 'chapter';
    normalized.chapterTitle = normalized.chapterTitle ?? normalized.unitTitle;
    delete normalized.unitNumber;
    delete normalized.unitType;
    delete normalized.unitTitle;
  }

  return normalized;
}

function compareDocs(
  pre: Record<string, unknown>,
  post: Record<string, unknown>,
  ignoredFields: string[] = [],
): string[] {
  const diffs: string[] = [];
  const keys = new Set([...Object.keys(pre), ...Object.keys(post)]);
  for (const k of keys) {
    if (ignoredFields.includes(k)) continue;
    if (k === '_id') continue;
    if (JSON.stringify(pre[k]) !== JSON.stringify(post[k])) {
      diffs.push(k);
    }
  }
  return diffs;
}

function buildMap(docs: any[], keyFn: (d: any) => string): Map<string, any> {
  const map = new Map<string, any>();
  for (const doc of docs) {
    map.set(keyFn(doc), doc);
  }
  return map;
}

function getDocKey(doc: any, collection: string): string {
  if (ID_PRESERVED_COLLECTIONS.has(collection)) {
    return idString(doc._id);
  }
  return idString(doc._id);
}

function ignoredFieldsFor(collection: string): string[] {
  const common = ['_id', 'createdAt', 'updatedAt', '__v'];
  if (collection === 'migrations') {
    return [...common, 'completedAt'];
  }
  if (collection === 'books' || collection === 'novels') {
    return [...common, 'addedByUserId', 'userId', 'mediaType', 'authorId', 'authorIds', 'genreIds', 'genres', 'publicationStatusId', 'coverImageToken', 'coverImageSyncedAt', 'rawLegacyEntry', 'personalTags', 'personalTagKeys', 'lastVisitedChapterNumber', 'lastVisitedAt', 'completedAt', 'characterNotes', 'relationshipNotes', 'rawLegacyEntry', 'status', 'chaptersRead', 'rating', 'review', 'personalNotes', 'originalSourceKey', 'chaptersList', 'unitsList', 'chaptersTotal', 'unitsTotal', 'rawChaptersList', 'rawUnitsList'];
  }
  if (collection === 'bookcontents' || collection === 'rawbookcontents' || collection === 'chaptercontents' || collection === 'rawchaptercontents') {
    return [...common, 'scrapedAt', 'lastSyncAt'];
  }
  if (collection === 'userbooks' || collection === 'usernovels') {
    return [...common, 'rawLegacyEntry', 'personalTagKeys', 'lastVisitedAt', 'completedAt', 'personalNotes', 'review', 'characterNotes', 'relationshipNotes', 'lastVisitedUnitNumber', 'unitsRead'];
  }
  if (collection === 'bookvisits' || collection === 'chaptervisits') {
    return [...common];
  }
  return common;
}

export async function runVerify({
  pre,
  post,
}: {
  pre: BackupResult;
  post: BackupResult;
}): Promise<VerifyResult> {
  const messages: string[] = ['\nBackup verification (document-level):'];
  const mismatches: VerifyMismatches = { missing: [], extra: [], altered: [] };
  let ok = true;

  const oldNovelsById = new Map<string, any>();
  if (pre.docs['novels']) {
    for (const doc of pre.docs['novels']) oldNovelsById.set(idString(doc._id), doc);
  }

  const preCollections = new Set(Object.keys(pre.counts));
  const postCollections = new Set(Object.keys(post.counts));

  // Collections that are verified by the old -> new comparison above should not
  // be re-checked pre vs post (pre may contain stale data with different _ids).
  const migratedTargets = new Set<string>();
  for (const [oldName, newName] of Object.entries(OLD_TO_NEW)) {
    if (preCollections.has(oldName)) migratedTargets.add(newName);
  }

  // Old -> new migrated collections
  for (const [oldName, newName] of Object.entries(OLD_TO_NEW)) {
    const preDocs = pre.docs[oldName] || [];
    const postDocs = post.docs[newName] || [];

    if (preDocs.length === 0 && postDocs.length === 0) {
      messages.push(`[OK] ${oldName} -> ${newName}: both empty`);
      continue;
    }

    if (preDocs.length === 0) {
      messages.push(`[INFO] ${oldName} was empty; ${newName} has ${postDocs.length} documents`);
      continue;
    }

    if (postDocs.length === 0) {
      for (const doc of preDocs) {
        const id = getDocKey(doc, oldName);
        mismatches.missing.push({ collection: newName, id });
        messages.push(`[LOST] ${oldName} -> ${newName}: document ${id} missing`);
        ok = false;
      }
      continue;
    }

    const preMap = buildMap(preDocs, (d) => getDocKey(d, oldName));
    const postMap = buildMap(postDocs, (d) => getDocKey(d, newName));

    let missing = 0;
    let altered = 0;
    for (const [id, preDoc] of preMap) {
      const postDoc = postMap.get(id);
      if (!postDoc) {
        mismatches.missing.push({ collection: newName, id });
        messages.push(`[LOST] ${oldName} -> ${newName}: document ${id} missing`);
        ok = false;
        missing++;
        continue;
      }
      const nPre = normalizeMigratedDoc(preDoc, oldName, true, oldNovelsById);
      const nPost = normalizeMigratedDoc(postDoc, newName, false);
      const diffs = compareDocs(nPre, nPost, ignoredFieldsFor(newName));
      if (diffs.length) {
        mismatches.altered.push({ collection: newName, id, fields: diffs });
        messages.push(`[ALTERED] ${oldName} -> ${newName}: document ${id} differs in ${diffs.join(', ')}`);
        altered++;
      }
    }

    let extra = 0;
    let derived = 0;
    for (const [id, postDoc] of postMap) {
      if (preMap.has(id)) continue;
      if (newName === 'userbooks') {
        // A userbook may be derived from a novels.userId legacy field.
        const novel = oldNovelsById.get(idString(postDoc.bookId));
        if (novel && String(novel.userId) === String(postDoc.userId)) {
          derived++;
          continue;
        }
      }
      mismatches.extra.push({ collection: newName, id });
      extra++;
    }

    if (missing === 0 && altered === 0 && extra === 0) {
      messages.push(`[OK] ${oldName} -> ${newName}: all ${preDocs.length} documents verified`);
    } else if (missing === 0 && altered === 0 && extra > 0) {
      messages.push(`[OK] ${oldName} -> ${newName}: ${preDocs.length} verified, ${extra} extra`);
      if (derived) messages.push(`[INFO] ${newName}: ${derived} derived from novels.userId`);
    } else {
      if (missing) messages.push(`[FAIL] ${oldName} -> ${newName}: ${missing} missing`);
      if (altered) messages.push(`[FAIL] ${oldName} -> ${newName}: ${altered} altered`);
      if (extra) messages.push(`[FAIL] ${oldName} -> ${newName}: ${extra} extra`);
      ok = false;
    }
  }

  // Same-name collections
  for (const name of preCollections) {
    if (OLD_TO_NEW[name] || migratedTargets.has(name)) continue; // already handled above
    const preDocs = pre.docs[name] || [];
    const postDocs = post.docs[name] || [];
    const postMap = buildMap(postDocs, (d) => idString(d._id));

    let missing = 0;
    let altered = 0;
    for (const preDoc of preDocs) {
      const id = idString(preDoc._id);
      const postDoc = postMap.get(id);
      if (!postDoc) {
        mismatches.missing.push({ collection: name, id });
        messages.push(`[LOST] ${name}: document ${id} missing`);
        ok = false;
        missing++;
        continue;
      }
      const nPre = normalizeUnitToChapter(preDoc);
      const nPost = normalizeUnitToChapter(postDoc);
      const diffs = compareDocs(nPre, nPost, ignoredFieldsFor(name));
      if (diffs.length) {
        mismatches.altered.push({ collection: name, id, fields: diffs });
        messages.push(`[ALTERED] ${name}: document ${id} differs in ${diffs.join(', ')}`);
        altered++;
      }
    }

    let extra = 0;
    for (const postDoc of postDocs) {
      const id = idString(postDoc._id);
      if (!preDocs.some((d) => idString(d._id) === id)) {
        if (ALLOW_EXTRA.has(name)) {
          // expected extra from seed/migration
        } else {
          mismatches.extra.push({ collection: name, id });
          messages.push(`[EXTRA] ${name}: document ${id} not in pre-backup`);
          extra++;
        }
      }
    }

    if (missing === 0 && altered === 0 && extra === 0) {
      if (preDocs.length === postDocs.length) {
        messages.push(`[OK] ${name}: unchanged (${preDocs.length})`);
      } else if (postDocs.length > preDocs.length) {
        messages.push(`[CHANGED] ${name}: ${preDocs.length} -> ${postDocs.length} (added ${postDocs.length - preDocs.length})`);
      } else {
        messages.push(`[CHANGED] ${name}: ${preDocs.length} -> ${postDocs.length}`);
      }
    } else if (SEED_MANAGED.has(name) && missing === 0) {
      messages.push(`[INFO] ${name}: seed-managed (${preDocs.length} -> ${postDocs.length}, ${altered} altered, ${extra} extra)`);
    } else {
      if (missing) messages.push(`[FAIL] ${name}: ${missing} missing`);
      if (altered) messages.push(`[FAIL] ${name}: ${altered} altered`);
      if (extra) messages.push(`[FAIL] ${name}: ${extra} extra`);
      ok = false;
    }
  }

  // New collections not in pre
  for (const name of postCollections) {
    if (preCollections.has(name) || Object.values(OLD_TO_NEW).includes(name)) continue;
    const count = post.counts[name] || 0;
    if (ALLOW_EXTRA.has(name)) {
      messages.push(`[INFO] ${name}: ${count} documents (new)`);
    } else {
      messages.push(`[WARN] ${name}: ${count} documents in post but not in pre`);
      ok = false;
    }
  }

  messages.push(ok ? '\n[OK] Verification passed.' : '\n[FAIL] Verification failed.');

  return {
    ok,
    counts: { pre: pre.counts, post: post.counts },
    mismatches,
    messages,
  };
}

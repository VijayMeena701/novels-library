import mongoose from 'mongoose';
import { Genre, IGenre } from '../models/Genre.js';
import { PublicationStatus, IPublicationStatus } from '../models/PublicationStatus.js';
import { Novel, normalizeFilterKey } from '../models/Novel.js';

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function cleanStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const value of values) {
    const displayValue = cleanString(value);
    const key = normalizeFilterKey(displayValue);
    if (!displayValue || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    cleaned.push(displayValue);
  }

  return cleaned;
}

function toObjectIds(values: unknown): mongoose.Types.ObjectId[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const ids: mongoose.Types.ObjectId[] = [];
  for (const value of values) {
    const raw = typeof value === 'string' ? value : String(value || '');
    if (!mongoose.Types.ObjectId.isValid(raw) || seen.has(raw)) {
      continue;
    }

    seen.add(raw);
    ids.push(new mongoose.Types.ObjectId(raw));
  }

  return ids;
}

export async function findOrCreateGenre(name: unknown): Promise<IGenre | null> {
  const displayName = cleanString(name);
  const key = normalizeFilterKey(displayName);
  if (!displayName || !key) {
    return null;
  }

  const existing = await Genre.findOne({ $or: [{ key }, { aliases: displayName }] });
  if (existing) {
    return existing;
  }

  return Genre.create({ name: displayName, key });
}

export async function resolveGenres(input: { genreIds?: unknown; genres?: unknown }) {
  const ids = toObjectIds(input.genreIds);
  const names = cleanStringList(input.genres);
  const created = await Promise.all(names.map((name) => findOrCreateGenre(name)));
  const createdIds = created
    .filter((genre): genre is IGenre => Boolean(genre))
    .map((genre) => genre._id as mongoose.Types.ObjectId);

  const allIds = [...ids, ...createdIds];
  const uniqueIds = Array.from(new Map(allIds.map((id) => [id.toString(), id])).values());
  const docs = uniqueIds.length > 0 ? await Genre.find({ _id: { $in: uniqueIds } }).sort({ name: 1 }) : [];

  return {
    genreIds: docs.map((genre) => genre._id as mongoose.Types.ObjectId),
    genres: docs.map((genre) => genre.name),
    genreKeys: docs.map((genre) => genre.key),
  };
}

export async function findOrCreatePublicationStatus(name: unknown): Promise<IPublicationStatus | null> {
  const displayName = cleanString(name);
  const key = normalizeFilterKey(displayName);
  if (!displayName || !key) {
    return null;
  }

  const existing = await PublicationStatus.findOne({ $or: [{ key }, { aliases: displayName }] });
  if (existing) {
    return existing;
  }

  return PublicationStatus.create({ name: displayName, key });
}

export async function resolvePublicationStatus(input: { publicationStatusId?: unknown; publicationStatus?: unknown }) {
  const rawId = typeof input.publicationStatusId === 'string' ? input.publicationStatusId : '';
  if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
    const existing = await PublicationStatus.findById(rawId);
    if (existing) {
      return {
        publicationStatusId: existing._id as mongoose.Types.ObjectId,
        publicationStatus: existing.name,
        publicationStatusKey: existing.key,
      };
    }
  }

  const status = await findOrCreatePublicationStatus(input.publicationStatus);
  if (!status) {
    return {};
  }

  return {
    publicationStatusId: status._id as mongoose.Types.ObjectId,
    publicationStatus: status.name,
    publicationStatusKey: status.key,
  };
}

export async function backfillNovelTaxonomy(limit = 500) {
  const novels = await Novel.find({
    $or: [
      { genreIds: { $size: 0 }, genres: { $exists: true, $ne: [] } },
      { publicationStatusId: { $exists: false }, publicationStatus: { $exists: true, $ne: '' } },
    ],
  }).limit(limit);

  for (const novel of novels) {
    if ((!novel.genreIds || novel.genreIds.length === 0) && novel.genres?.length) {
      const resolvedGenres = await resolveGenres({ genres: novel.genres });
      novel.genreIds = resolvedGenres.genreIds;
      novel.genres = resolvedGenres.genres;
      novel.genreKeys = resolvedGenres.genreKeys;
    }

    if (!novel.publicationStatusId && novel.publicationStatus) {
      const resolvedStatus = await resolvePublicationStatus({ publicationStatus: novel.publicationStatus });
      if (resolvedStatus.publicationStatusId) {
        novel.publicationStatusId = resolvedStatus.publicationStatusId;
        novel.publicationStatus = resolvedStatus.publicationStatus || novel.publicationStatus;
        novel.publicationStatusKey = resolvedStatus.publicationStatusKey || novel.publicationStatusKey;
      }
    }

    await novel.save();
  }
}

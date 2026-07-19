import mongoose from 'mongoose';
import { Author, IAuthor } from '../models/Author';
import { normalizeFilterKey } from '../models/Book';

export interface AuthorInput {
  author?: string;
  penName?: string;
  realName?: string;
  alternativeNames?: string[];
  originalLanguage?: string;
  officialUrl?: string;
}

export interface ResolveAuthorsInput extends AuthorInput {
  authorId?: unknown;
  authorIds?: unknown;
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function cleanStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map(cleanString).filter(Boolean);
}

function splitAuthorNames(value: unknown): string[] {
  const raw = cleanString(value);
  if (!raw) {
    return [];
  }

  return raw
    .split(/[,;、，]| and /i)
    .map(cleanString)
    .filter(Boolean);
}

function applyAuthorUpdates(
  existing: IAuthor,
  penName: string,
  realName: string,
  alternativeNames: string[],
  originalLanguage: string,
  officialUrl?: string,
): boolean {
  let changed = false;

  if (penName && !existing.penName) {
    existing.penName = penName;
    changed = true;
  }
  if (realName && !existing.realName) {
    existing.realName = realName;
    changed = true;
  }
  if (originalLanguage && !existing.originalLanguage) {
    existing.originalLanguage = originalLanguage;
    changed = true;
  }
  if (officialUrl && !existing.officialUrls.includes(officialUrl)) {
    existing.officialUrls.push(officialUrl);
    changed = true;
  }

  const nextAlternativeNames = Array.from(new Set([...existing.alternativeNames, ...alternativeNames]));
  if (nextAlternativeNames.length !== existing.alternativeNames.length) {
    existing.alternativeNames = nextAlternativeNames;
    changed = true;
  }

  return changed;
}

export async function findOrCreateAuthor(input: AuthorInput): Promise<IAuthor | null> {
  const penName = cleanString(input.penName || input.author);
  const realName = cleanString(input.realName);
  const alternativeNames = cleanStringList(input.alternativeNames);
  const displayName = penName || realName || alternativeNames[0] || '';
  const originalLanguage = cleanString(input.originalLanguage);

  if (!displayName) {
    return null;
  }

  const candidateKeys = [displayName, penName, realName, ...alternativeNames].map(normalizeFilterKey).filter(Boolean);

  const existing = await Author.findOne({ nameKeys: { $in: candidateKeys } });
  if (existing) {
    const changed = applyAuthorUpdates(
      existing,
      penName,
      realName,
      alternativeNames,
      originalLanguage,
      input.officialUrl,
    );
    if (changed) {
      await existing.save();
    }

    return existing;
  }

  return Author.create({
    displayName,
    penName,
    realName,
    alternativeNames,
    originalLanguage,
    officialUrls: input.officialUrl ? [input.officialUrl] : [],
  });
}

export function toAuthorObjectId(authorId: unknown): mongoose.Types.ObjectId | undefined {
  if (typeof authorId === 'string' && mongoose.Types.ObjectId.isValid(authorId)) {
    return new mongoose.Types.ObjectId(authorId);
  }

  return undefined;
}

export function toAuthorObjectIds(authorIds: unknown): mongoose.Types.ObjectId[] {
  if (!Array.isArray(authorIds)) {
    return [];
  }

  const seen = new Set<string>();
  const ids: mongoose.Types.ObjectId[] = [];
  for (const authorId of authorIds) {
    const id = toAuthorObjectId(authorId);
    if (!id || seen.has(id.toString())) {
      continue;
    }

    seen.add(id.toString());
    ids.push(id);
  }

  return ids;
}

export async function resolveAuthorIds(input: ResolveAuthorsInput): Promise<mongoose.Types.ObjectId[]> {
  const explicitIds = [
    ...toAuthorObjectIds(input.authorIds),
    ...(toAuthorObjectId(input.authorId) ? [toAuthorObjectId(input.authorId)!] : []),
  ];

  const createdAuthors = await Promise.all(
    splitAuthorNames(input.author || input.penName).map((name, index) =>
      findOrCreateAuthor({
        author: name,
        penName: index === 0 ? input.penName || name : name,
        realName: index === 0 ? input.realName : '',
        alternativeNames: index === 0 ? input.alternativeNames : [],
        originalLanguage: input.originalLanguage,
        officialUrl: input.officialUrl,
      }),
    ),
  );

  const createdIds = createdAuthors
    .filter((author): author is IAuthor => Boolean(author))
    .map((author) => author._id as mongoose.Types.ObjectId);

  return Array.from(new Map([...explicitIds, ...createdIds].map((id) => [id.toString(), id])).values());
}

import { createReadStream } from 'node:fs';
import { access, mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const STORAGE_ROOT = path.resolve(process.env.COVER_STORAGE_DIR || path.join(process.cwd(), 'storage'));
const COVER_DIR = path.join(STORAGE_ROOT, 'covers');
const COVER_DOWNLOAD_TIMEOUT_MS = getNumberFromEnv('COVER_DOWNLOAD_TIMEOUT_MS', 20000, 1000, 120000);
const COVER_IMAGE_MAX_BYTES = getNumberFromEnv('COVER_IMAGE_MAX_BYTES', 10 * 1024 * 1024, 1024, 50 * 1024 * 1024);
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

function getNumberFromEnv(name: string, defaultValue: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, parsed));
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getMimeTypeFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const extension = path.extname(pathname).replace('.', '').toLowerCase();
  return EXTENSION_TO_MIME[extension] || '';
}

function cleanMimeType(value: string | null): string {
  return value?.split(';')[0].trim().toLowerCase() || '';
}

function getExtensionForMimeType(mimeType: string): string {
  const extension = MIME_TO_EXTENSION[mimeType];
  if (!extension) {
    throw new Error(`Unsupported cover image type: ${mimeType || 'unknown'}`);
  }

  return extension;
}

export function resolveCoverImagePath(relativePath: string): string {
  const absolutePath = path.resolve(STORAGE_ROOT, relativePath);
  if (!absolutePath.startsWith(`${STORAGE_ROOT}${path.sep}`)) {
    throw new Error('Invalid cover image path.');
  }

  return absolutePath;
}

export async function deleteCoverImageFile(relativePath?: string) {
  if (!relativePath) {
    return;
  }

  try {
    await unlink(resolveCoverImagePath(relativePath));
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

export async function createCoverImageReadStream(relativePath: string) {
  const absolutePath = resolveCoverImagePath(relativePath);
  await access(absolutePath);
  return createReadStream(absolutePath);
}

export async function getCoverImageSize(relativePath: string) {
  const fileStat = await stat(resolveCoverImagePath(relativePath));
  return fileStat.size;
}

export async function syncBookCoverImage(book: any, coverUrl: string) {
  const sourceUrl = coverUrl?.trim();
  if (!sourceUrl || !isHttpUrl(sourceUrl)) {
    throw new Error('Cover URL must be a valid HTTP/HTTPS URL.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COVER_DOWNLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5',
        Referer: new URL(sourceUrl).origin,
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Cover download failed with HTTP ${response.status}.`);
  }

  const contentLength = Number.parseInt(response.headers.get('content-length') || '', 10);
  if (Number.isFinite(contentLength) && contentLength > COVER_IMAGE_MAX_BYTES) {
    throw new Error(`Cover image is too large (${contentLength} bytes).`);
  }

  let mimeType = cleanMimeType(response.headers.get('content-type'));
  if (!MIME_TO_EXTENSION[mimeType]) {
    mimeType = getMimeTypeFromUrl(sourceUrl);
  }

  const extension = getExtensionForMimeType(mimeType);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > COVER_IMAGE_MAX_BYTES) {
    throw new Error(`Cover image is too large (${buffer.length} bytes).`);
  }

  const previousPath = book.coverImagePath;
  const token = randomUUID().replaceAll('-', '');
  const fileName = `${book._id.toString()}-${token}.${extension}`;
  const relativePath = path.join('covers', fileName);

  await mkdir(COVER_DIR, { recursive: true });
  await writeFile(resolveCoverImagePath(relativePath), buffer);

  if (previousPath && previousPath !== relativePath) {
    await deleteCoverImageFile(previousPath);
  }

  book.coverUrl = sourceUrl;
  book.coverImagePath = relativePath;
  book.coverImageMimeType = mimeType;
  book.coverImageSize = buffer.length;
  book.coverImageToken = token;
  book.coverImageSyncedAt = new Date();
}

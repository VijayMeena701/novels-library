import { FastifyReply, FastifyRequest } from 'fastify';
import {
  createDefaultReaderSettings,
  IReaderPortalPosition,
  IReaderSettings,
  ReaderTheme,
  ReaderWidth,
  UserSettings,
} from '../models/UserSettings.js';

const READER_THEMES: ReaderTheme[] = ['dark', 'light', 'sepia'];
const READER_WIDTHS: ReaderWidth[] = ['narrow', 'medium', 'wide'];

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(max, Math.max(min, parsed));
}

function cleanReaderPatch(input: unknown): Partial<IReaderSettings> {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const source = input as Record<string, unknown>;
  const patch: Partial<IReaderSettings> = {};

  if (typeof source.theme === 'string' && READER_THEMES.includes(source.theme as ReaderTheme)) {
    patch.theme = source.theme as ReaderTheme;
  }

  const fontSize = clampNumber(source.fontSize, 12, 32);
  if (fontSize !== undefined) {
    patch.fontSize = Math.round(fontSize);
  }

  if (typeof source.width === 'string' && READER_WIDTHS.includes(source.width as ReaderWidth)) {
    patch.width = source.width as ReaderWidth;
  }

  if (typeof source.autoNext === 'boolean') {
    patch.autoNext = source.autoNext;
  }

  const speechRate = clampNumber(source.speechRate, 0.5, 4);
  if (speechRate !== undefined) {
    patch.speechRate = Number(speechRate.toFixed(2));
  }

  const speechPitch = clampNumber(source.speechPitch, 0.5, 2);
  if (speechPitch !== undefined) {
    patch.speechPitch = Number(speechPitch.toFixed(2));
  }

  if (typeof source.voiceURI === 'string') {
    patch.voiceURI = source.voiceURI.trim().slice(0, 300);
  }

  if (source.speechPortalPosition && typeof source.speechPortalPosition === 'object') {
    const positionSource = source.speechPortalPosition as Record<string, unknown>;
    const x = clampNumber(positionSource.x, 0, 4000);
    const y = clampNumber(positionSource.y, 0, 4000);
    const position: Partial<IReaderPortalPosition> = {};

    if (x !== undefined) position.x = Math.round(x);
    if (y !== undefined) position.y = Math.round(y);
    if (position.x !== undefined || position.y !== undefined) {
      patch.speechPortalPosition = position as IReaderPortalPosition;
    }
  }

  return patch;
}

async function getOrCreateUserSettings(userId: string) {
  try {
    return await UserSettings.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, reader: createDefaultReaderSettings() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err: any) {
    if (err?.code === 11000) {
      return UserSettings.findOne({ userId });
    }

    throw err;
  }
}

export async function getUserSettingsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;

  try {
    const settings = await getOrCreateUserSettings(userId);
    return reply.send(settings);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error loading user settings.' });
  }
}

export async function updateUserSettingsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const body = (request.body || {}) as { reader?: unknown };

  try {
    const settings = await getOrCreateUserSettings(userId);
    if (!settings) {
      return reply.status(404).send({ error: 'User settings not found.' });
    }

    const existingReader = settings.toObject().reader || createDefaultReaderSettings();
    const readerPatch = cleanReaderPatch(body.reader);
    const nextReader: IReaderSettings = {
      ...createDefaultReaderSettings(),
      ...existingReader,
      ...readerPatch,
      speechPortalPosition: {
        ...createDefaultReaderSettings().speechPortalPosition,
        ...existingReader.speechPortalPosition,
        ...readerPatch.speechPortalPosition,
      },
    };

    settings.set('reader', nextReader);
    await settings.save();

    return reply.send(settings);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating user settings.' });
  }
}

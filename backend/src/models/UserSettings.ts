import mongoose, { Schema, Document } from 'mongoose';

export type ReaderTheme = 'paper' | 'sepia' | 'forest' | 'night' | 'amoled';
export type ReaderWidth = 'narrow' | 'medium' | 'wide';
export type ReaderHighlightMode = 'off' | 'paragraph' | 'word';
export type ReaderAutoScrollBehavior = 'smooth' | 'instant';

export interface IReaderPortalPosition {
  x: number;
  y: number;
}

export interface IReaderSettings {
  theme: ReaderTheme;
  fontSize: number;
  width: ReaderWidth;
  autoNext: boolean;
  speechRate: number;
  speechPitch: number;
  voiceURI: string;
  speechPortalPosition: IReaderPortalPosition;
  highlightMode: ReaderHighlightMode;
  highlightParagraph: boolean;
  paragraphHighlightColor: string;
  wordHighlightColor: string;
  sentenceHighlightOpacity: number;
  autoScrollDuringSpeech: boolean;
  autoScrollBehavior: ReaderAutoScrollBehavior;
  autoScrollOffset: number;
}

export interface IUserSettings extends Document {
  userId: mongoose.Types.ObjectId;
  reader: IReaderSettings;
  createdAt: Date;
  updatedAt: Date;
}

export function createDefaultReaderSettings(): IReaderSettings {
  return {
    theme: 'paper',
    fontSize: 18,
    width: 'narrow',
    autoNext: false,
    speechRate: 1,
    speechPitch: 1,
    voiceURI: '',
    speechPortalPosition: {
      x: 24,
      y: 120,
    },
    highlightMode: 'paragraph',
    highlightParagraph: true,
    paragraphHighlightColor: '#f5d67a',
    wordHighlightColor: '#f59e0b',
    sentenceHighlightOpacity: 0.2,
    autoScrollDuringSpeech: true,
    autoScrollBehavior: 'smooth',
    autoScrollOffset: 120,
  };
}

const ReaderPortalPositionSchema = new Schema<IReaderPortalPosition>(
  {
    x: { type: Number, default: 24, min: 0, max: 4000 },
    y: { type: Number, default: 120, min: 0, max: 4000 },
  },
  { _id: false },
);

const ReaderSettingsSchema = new Schema<IReaderSettings>(
  {
    theme: { type: String, enum: ['paper', 'sepia', 'forest', 'night', 'amoled'], default: 'paper' },
    fontSize: { type: Number, default: 18, min: 12, max: 32 },
    width: { type: String, enum: ['narrow', 'medium', 'wide'], default: 'narrow' },
    autoNext: { type: Boolean, default: false },
    speechRate: { type: Number, default: 1, min: 0.5, max: 4 },
    speechPitch: { type: Number, default: 1, min: 0.5, max: 2 },
    voiceURI: { type: String, default: '' },
    speechPortalPosition: {
      type: ReaderPortalPositionSchema,
      default: () => createDefaultReaderSettings().speechPortalPosition,
    },
    highlightMode: { type: String, enum: ['off', 'paragraph', 'word'], default: 'paragraph' },
    highlightParagraph: { type: Boolean, default: true },
    paragraphHighlightColor: { type: String, default: '#f5d67a' },
    wordHighlightColor: { type: String, default: '#f59e0b' },
    sentenceHighlightOpacity: { type: Number, default: 0.2, min: 0.05, max: 0.6 },
    autoScrollDuringSpeech: { type: Boolean, default: true },
    autoScrollBehavior: { type: String, enum: ['smooth', 'instant'], default: 'smooth' },
    autoScrollOffset: { type: Number, default: 120, min: 48, max: 260 },
  },
  { _id: false },
);

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    reader: { type: ReaderSettingsSchema, default: createDefaultReaderSettings },
  },
  { timestamps: true },
);

export const UserSettings = mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema);

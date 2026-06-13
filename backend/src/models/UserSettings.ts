import mongoose, { Schema, Document } from 'mongoose';

export type ReaderTheme = 'dark' | 'light' | 'sepia';
export type ReaderWidth = 'narrow' | 'medium' | 'wide';

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
}

export interface IUserSettings extends Document {
  userId: mongoose.Types.ObjectId;
  reader: IReaderSettings;
  createdAt: Date;
  updatedAt: Date;
}

export function createDefaultReaderSettings(): IReaderSettings {
  return {
    theme: 'sepia',
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
  };
}

const ReaderPortalPositionSchema = new Schema<IReaderPortalPosition>({
  x: { type: Number, default: 24, min: 0, max: 4000 },
  y: { type: Number, default: 120, min: 0, max: 4000 },
}, { _id: false });

const ReaderSettingsSchema = new Schema<IReaderSettings>({
  theme: { type: String, enum: ['dark', 'light', 'sepia'], default: 'sepia' },
  fontSize: { type: Number, default: 18, min: 12, max: 32 },
  width: { type: String, enum: ['narrow', 'medium', 'wide'], default: 'narrow' },
  autoNext: { type: Boolean, default: false },
  speechRate: { type: Number, default: 1, min: 0.5, max: 4 },
  speechPitch: { type: Number, default: 1, min: 0.5, max: 2 },
  voiceURI: { type: String, default: '' },
  speechPortalPosition: { type: ReaderPortalPositionSchema, default: () => createDefaultReaderSettings().speechPortalPosition },
}, { _id: false });

const UserSettingsSchema = new Schema<IUserSettings>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  reader: { type: ReaderSettingsSchema, default: createDefaultReaderSettings },
}, { timestamps: true });

export const UserSettings = mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema);

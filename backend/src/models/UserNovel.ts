import mongoose, { Schema, Document } from 'mongoose';
import { BookStatus, normalizeFilterKey } from './Novel.js';

export interface IUserBook extends Document {
  userId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  status: BookStatus;
  chaptersRead: number;
  rating: number;
  review: string;
  personalNotes: string;
  rawLegacyEntry: string;
  characterNotes: string;
  relationshipNotes: string;
  personalTags: string[];
  personalTagKeys: string[];
  completedAt?: Date;
  lastVisitedChapterNumber?: number;
  lastVisitedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

function cleanStringList(values: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const value of values || []) {
    const displayValue = String(value).replace(/\s+/g, ' ').trim();
    const key = normalizeFilterKey(displayValue);
    if (!displayValue || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    cleaned.push(displayValue);
  }

  return cleaned;
}

const UserBookSchema = new Schema<IUserBook>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    status: {
      type: String,
      enum: ['reading', 'completed', 'on_hold', 'dropped', 'planning'],
      default: 'planning',
      index: true,
    },
    chaptersRead: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    review: { type: String, default: '' },
    personalNotes: { type: String, default: '' },
    rawLegacyEntry: { type: String, default: '' },
    characterNotes: { type: String, default: '' },
    relationshipNotes: { type: String, default: '' },
    personalTags: { type: [String], default: [], index: true },
    personalTagKeys: { type: [String], default: [], index: true },
    completedAt: { type: Date },
    lastVisitedChapterNumber: { type: Number },
    lastVisitedAt: { type: Date },
  },
  { timestamps: true },
);

UserBookSchema.pre('validate', function normalizeUserBookFields(next) {
  this.personalTags = cleanStringList(this.personalTags);
  this.personalTagKeys = this.personalTags.map(normalizeFilterKey).filter(Boolean);
  next();
});

UserBookSchema.index({ userId: 1, bookId: 1 }, { unique: true });
UserBookSchema.index({ userId: 1, status: 1, updatedAt: -1 });
UserBookSchema.index({ userId: 1, personalTagKeys: 1, updatedAt: -1 });

export const UserBook = mongoose.model<IUserBook>('UserBook', UserBookSchema);

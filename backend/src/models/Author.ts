import mongoose, { Schema, Document } from 'mongoose';
import { normalizeFilterKey } from './Novel.js';

export interface IAuthor extends Document {
  displayName: string;
  penName: string;
  realName: string;
  alternativeNames: string[];
  nameKeys: string[];
  originalLanguage: string;
  officialUrls: string[];
  notes: string;
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

const AuthorSchema = new Schema<IAuthor>(
  {
    displayName: { type: String, required: true, index: true },
    penName: { type: String, default: '' },
    realName: { type: String, default: '' },
    alternativeNames: { type: [String], default: [] },
    nameKeys: { type: [String], default: [] },
    originalLanguage: { type: String, default: '' },
    officialUrls: { type: [String], default: [] },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

AuthorSchema.pre('validate', function normalizeAuthorFields(next) {
  this.displayName = this.displayName?.replace(/\s+/g, ' ').trim() || this.penName || this.realName || 'Unknown Author';
  this.penName = this.penName?.replace(/\s+/g, ' ').trim() || '';
  this.realName = this.realName?.replace(/\s+/g, ' ').trim() || '';
  this.alternativeNames = cleanStringList(this.alternativeNames);
  this.officialUrls = cleanStringList(this.officialUrls);

  const keys = [this.displayName, this.penName, this.realName, ...this.alternativeNames]
    .map(normalizeFilterKey)
    .filter(Boolean);
  this.nameKeys = Array.from(new Set(keys));

  next();
});

AuthorSchema.index({ nameKeys: 1 });

export const Author = mongoose.model<IAuthor>('Author', AuthorSchema);

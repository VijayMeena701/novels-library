import mongoose, { Schema, Document } from 'mongoose';
import { normalizeFilterKey } from './Novel.js';

export interface IGenre extends Document {
  name: string;
  key: string;
  aliases: string[];
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

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

const GenreSchema = new Schema<IGenre>(
  {
    name: { type: String, required: true, index: true },
    key: { type: String, required: true, unique: true, index: true },
    aliases: { type: [String], default: [] },
    description: { type: String, default: '' },
  },
  { timestamps: true },
);

GenreSchema.pre('validate', function normalizeGenreFields(next) {
  this.name = cleanString(this.name);
  this.key = normalizeFilterKey(this.key || this.name);
  this.aliases = cleanStringList(this.aliases);
  this.description = cleanString(this.description);
  next();
});

export const Genre = mongoose.model<IGenre>('Genre', GenreSchema);

import mongoose, { Schema, Document } from 'mongoose';
import { normalizeFilterKey } from './Novel.js';

export interface IPublicationStatus extends Document {
  name: string;
  key: string;
  aliases: string[];
  color: string;
  sortOrder: number;
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

const PublicationStatusSchema = new Schema<IPublicationStatus>({
  name: { type: String, required: true, index: true },
  key: { type: String, required: true, unique: true, index: true },
  aliases: { type: [String], default: [] },
  color: { type: String, default: '#64748b' },
  sortOrder: { type: Number, default: 100 },
}, { timestamps: true });

PublicationStatusSchema.pre('validate', function normalizePublicationStatusFields(next) {
  this.name = cleanString(this.name);
  this.key = normalizeFilterKey(this.key || this.name);
  this.aliases = cleanStringList(this.aliases);
  this.color = cleanString(this.color) || '#64748b';
  next();
});

PublicationStatusSchema.index({ sortOrder: 1, name: 1 });

export const PublicationStatus = mongoose.model<IPublicationStatus>('PublicationStatus', PublicationStatusSchema);

import mongoose, { Schema, Document } from 'mongoose';

export type NovelStatus = 'reading' | 'completed' | 'on_hold' | 'dropped' | 'planning';

export interface IChapterIndex {
  title: string;
  url: string;
  number: number;
}

export interface INovel extends Document {
  userId?: mongoose.Types.ObjectId;
  addedByUserId?: mongoose.Types.ObjectId;
  authorId?: mongoose.Types.ObjectId;
  authorIds: mongoose.Types.ObjectId[];
  title: string;
  author: string;
  authorPenName: string;
  authorRealName: string;
  alternativeNames: string[];
  genreIds: mongoose.Types.ObjectId[];
  genres: string[];
  genreKeys: string[];
  originalSource: string;
  originalSourceKey: string;
  publicationStatusId?: mongoose.Types.ObjectId;
  publicationStatus: string;
  publicationStatusKey: string;
  description: string;
  coverUrl: string;
  coverImagePath: string;
  coverImageMimeType: string;
  coverImageSize: number;
  coverImageToken: string;
  coverImageSyncedAt?: Date;
  sourceUrl: string;
  rawSourceUrl: string;
  rawOriginalLanguage: string;
  rawChaptersTotal: number;
  rawChaptersList: IChapterIndex[];
  status: NovelStatus;
  chaptersTotal: number;
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
  chaptersList: IChapterIndex[];
  createdAt: Date;
  updatedAt: Date;
}

export function normalizeFilterKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
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

const NovelSchema = new Schema<INovel>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  addedByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'Author', index: true },
  authorIds: [{ type: Schema.Types.ObjectId, ref: 'Author', index: true }],
  title: { type: String, required: true, index: true },
  author: { type: String, default: '' },
  authorPenName: { type: String, default: '' },
  authorRealName: { type: String, default: '' },
  alternativeNames: { type: [String], default: [] },
  genreIds: [{ type: Schema.Types.ObjectId, ref: 'Genre', index: true }],
  genres: { type: [String], default: [], index: true },
  genreKeys: { type: [String], default: [], index: true },
  originalSource: { type: String, default: '' },
  originalSourceKey: { type: String, default: '', index: true },
  publicationStatusId: { type: Schema.Types.ObjectId, ref: 'PublicationStatus', index: true },
  publicationStatus: { type: String, default: '' },
  publicationStatusKey: { type: String, default: '', index: true },
  description: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  coverImagePath: { type: String, default: '' },
  coverImageMimeType: { type: String, default: '' },
  coverImageSize: { type: Number, default: 0 },
  coverImageToken: { type: String, default: '', index: true },
  coverImageSyncedAt: { type: Date },
  sourceUrl: { type: String, default: '' },
  rawSourceUrl: { type: String, default: '' },
  rawOriginalLanguage: { type: String, default: '' },
  rawChaptersTotal: { type: Number, default: 0 },
  rawChaptersList: [
    {
      title: { type: String, required: true },
      url: { type: String, required: true },
      number: { type: Number, required: true },
    }
  ],
  status: { type: String, enum: ['reading', 'completed', 'on_hold', 'dropped', 'planning'], default: 'reading' },
  chaptersTotal: { type: Number, default: 0 },
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
  chaptersList: [
    {
      title: { type: String, required: true },
      url: { type: String, required: true },
      number: { type: Number, required: true },
    }
  ],
}, { timestamps: true });

NovelSchema.pre('validate', function normalizeFilterFields(next) {
  if (!this.addedByUserId && this.userId) {
    this.addedByUserId = this.userId;
  }
  if (!this.userId && this.addedByUserId) {
    this.userId = this.addedByUserId;
  }
  if ((!this.authorIds || this.authorIds.length === 0) && this.authorId) {
    this.authorIds = [this.authorId];
  }
  if (!this.authorId && this.authorIds?.length) {
    this.authorId = this.authorIds[0];
  }
  this.alternativeNames = cleanStringList(this.alternativeNames);
  this.genres = cleanStringList(this.genres);
  this.personalTags = cleanStringList(this.personalTags);
  this.genreKeys = this.genres.map(normalizeFilterKey).filter(Boolean);
  this.personalTagKeys = this.personalTags.map(normalizeFilterKey).filter(Boolean);
  this.originalSource = this.originalSource?.trim() || '';
  this.originalSourceKey = normalizeFilterKey(this.originalSource);
  this.publicationStatus = this.publicationStatus?.trim() || '';
  this.publicationStatusKey = normalizeFilterKey(this.publicationStatus);
  this.rawSourceUrl = this.rawSourceUrl?.trim() || '';
  this.rawOriginalLanguage = this.rawOriginalLanguage?.trim() || '';
  next();
});

NovelSchema.index({ authorId: 1, updatedAt: -1 });
NovelSchema.index({ authorIds: 1, updatedAt: -1 });
NovelSchema.index({ genreIds: 1, updatedAt: -1 });
NovelSchema.index({ publicationStatusId: 1, updatedAt: -1 });
NovelSchema.index({ addedByUserId: 1, updatedAt: -1 });
NovelSchema.index({ userId: 1, status: 1, updatedAt: -1 });
NovelSchema.index({ userId: 1, genreKeys: 1, updatedAt: -1 });
NovelSchema.index({ userId: 1, personalTagKeys: 1, updatedAt: -1 });
NovelSchema.index({ userId: 1, originalSourceKey: 1, updatedAt: -1 });
NovelSchema.index({ userId: 1, publicationStatusKey: 1, updatedAt: -1 });

export const Novel = mongoose.model<INovel>('Novel', NovelSchema);

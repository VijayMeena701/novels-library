import mongoose, { Schema, Document } from 'mongoose';

export type BookStatus = 'reading' | 'completed' | 'on_hold' | 'dropped' | 'planning';

export interface IChapterIndex {
  title: string;
  url: string;
  chapterNumber: number;
  chapterType: string;
}

export interface IBook extends Document {
  addedByUserId?: mongoose.Types.ObjectId;
  mediaType: string;
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
  status: BookStatus;
  translatedChaptersTotal: number;
  translatedChaptersList: IChapterIndex[];
  ratingAverage: number;
  ratingCount: number;
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

const BookSchema = new Schema<IBook>(
  {
    addedByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    mediaType: { type: String, default: 'novel' },
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
        chapterNumber: { type: Number, required: true },
        chapterType: { type: String, default: 'chapter' },
      },
    ],
    translatedChaptersTotal: { type: Number, default: 0 },
    translatedChaptersList: [
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
        chapterNumber: { type: Number, required: true },
        chapterType: { type: String, default: 'chapter' },
      },
    ],
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

BookSchema.pre('validate', function normalizeFilterFields(next) {
  if ((!this.authorIds || this.authorIds.length === 0) && this.authorId) {
    this.authorIds = [this.authorId];
  }
  if (!this.authorId && this.authorIds?.length) {
    this.authorId = this.authorIds[0];
  }
  this.alternativeNames = cleanStringList(this.alternativeNames);
  this.genres = cleanStringList(this.genres);
  this.genreKeys = this.genres.map(normalizeFilterKey).filter(Boolean);
  this.originalSource = this.originalSource?.trim() || '';
  this.originalSourceKey = normalizeFilterKey(this.originalSource);
  this.publicationStatus = this.publicationStatus?.trim() || '';
  this.publicationStatusKey = normalizeFilterKey(this.publicationStatus);
  this.rawSourceUrl = this.rawSourceUrl?.trim() || '';
  this.rawOriginalLanguage = this.rawOriginalLanguage?.trim() || '';
  next();
});

BookSchema.index({ authorId: 1, updatedAt: -1 });
BookSchema.index({ authorIds: 1, updatedAt: -1 });
BookSchema.index({ genreIds: 1, updatedAt: -1 });
BookSchema.index({ publicationStatusId: 1, updatedAt: -1 });
BookSchema.index({ addedByUserId: 1, updatedAt: -1 });
BookSchema.index({ ratingAverage: -1, ratingCount: -1 });
BookSchema.index({ ratingCount: -1, ratingAverage: -1 });

export const Book = mongoose.model<IBook>('Book', BookSchema);

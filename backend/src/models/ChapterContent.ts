import mongoose, { Schema, Document } from 'mongoose';

export interface IChapterContent extends Document {
  bookId: mongoose.Types.ObjectId;
  chapterNumber: number;
  chapterType?: string;
  title: string;
  content: string;
  sourceUrl: string;
  scrapedAt: Date;
}

const ChapterContentSchema = new Schema<IChapterContent>({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  chapterNumber: { type: Number, required: true },
  chapterType: { type: String, default: 'chapter' },
  title: { type: String, default: '' },
  content: { type: String, required: true },
  sourceUrl: { type: String, default: '' },
  scrapedAt: { type: Date, default: Date.now },
});

// Ensure uniqueness of chapter number per book
ChapterContentSchema.index({ bookId: 1, chapterNumber: 1 }, { unique: true });

export const ChapterContent = mongoose.model<IChapterContent>('ChapterContent', ChapterContentSchema, 'bookcontents');

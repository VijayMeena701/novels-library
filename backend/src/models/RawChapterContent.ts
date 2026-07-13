import mongoose, { Schema, Document } from 'mongoose';

export interface IRawChapterContent extends Document {
  bookId: mongoose.Types.ObjectId;
  chapterNumber: number;
  chapterType?: string;
  title: string;
  content: string;
  sourceUrl: string;
  language: string;
  scrapedAt: Date;
}

const RawChapterContentSchema = new Schema<IRawChapterContent>({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  chapterNumber: { type: Number, required: true },
  chapterType: { type: String, default: 'chapter' },
  title: { type: String, default: '' },
  content: { type: String, required: true },
  sourceUrl: { type: String, default: '' },
  language: { type: String, default: '' },
  scrapedAt: { type: Date, default: Date.now },
});

RawChapterContentSchema.index({ bookId: 1, chapterNumber: 1 }, { unique: true });

export const RawChapterContent = mongoose.model<IRawChapterContent>('RawChapterContent', RawChapterContentSchema, 'rawbookcontents');

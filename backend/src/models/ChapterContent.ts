import mongoose, { Schema, Document } from 'mongoose';

export interface IChapterContent extends Document {
  novelId: mongoose.Types.ObjectId;
  chapterNumber: number;
  title: string;
  content: string;
  sourceUrl: string;
  scrapedAt: Date;
}

const ChapterContentSchema = new Schema<IChapterContent>({
  novelId: { type: Schema.Types.ObjectId, ref: 'Novel', required: true, index: true },
  chapterNumber: { type: Number, required: true },
  title: { type: String, default: '' },
  content: { type: String, required: true },
  sourceUrl: { type: String, default: '' },
  scrapedAt: { type: Date, default: Date.now }
});

// Ensure uniqueness of chapter number per novel
ChapterContentSchema.index({ novelId: 1, chapterNumber: 1 }, { unique: true });

export const ChapterContent = mongoose.model<IChapterContent>('ChapterContent', ChapterContentSchema);

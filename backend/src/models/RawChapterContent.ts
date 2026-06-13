import mongoose, { Schema, Document } from 'mongoose';

export interface IRawChapterContent extends Document {
  novelId: mongoose.Types.ObjectId;
  chapterNumber: number;
  title: string;
  content: string;
  sourceUrl: string;
  language: string;
  scrapedAt: Date;
}

const RawChapterContentSchema = new Schema<IRawChapterContent>({
  novelId: { type: Schema.Types.ObjectId, ref: 'Novel', required: true, index: true },
  chapterNumber: { type: Number, required: true },
  title: { type: String, default: '' },
  content: { type: String, required: true },
  sourceUrl: { type: String, default: '' },
  language: { type: String, default: '' },
  scrapedAt: { type: Date, default: Date.now },
});

RawChapterContentSchema.index({ novelId: 1, chapterNumber: 1 }, { unique: true });

export const RawChapterContent = mongoose.model<IRawChapterContent>('RawChapterContent', RawChapterContentSchema);

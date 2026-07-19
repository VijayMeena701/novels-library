import mongoose, { Schema, Document } from 'mongoose';

export interface IChapterVisit extends Document {
  bookId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  chapterNumber: number;
  chapterType?: string;
  chapterTitle: string;
  sourceUrl: string;
  openedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChapterVisitSchema = new Schema<IChapterVisit>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ReadingSession', index: true },
    chapterNumber: { type: Number, required: true, index: true },
    chapterType: { type: String, default: 'chapter' },
    chapterTitle: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
    openedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

ChapterVisitSchema.index({ userId: 1, bookId: 1, openedAt: -1 });
ChapterVisitSchema.index({ userId: 1, sessionId: 1, openedAt: -1 });

export const ChapterVisit = mongoose.model<IChapterVisit>('ChapterVisit', ChapterVisitSchema, 'bookvisits');

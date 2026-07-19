import mongoose, { Schema, Document } from 'mongoose';

export type BookActivityType =
  | 'visit'
  | 'read'
  | 'rate'
  | 'review'
  | 'vote'
  | 'add_library'
  | 'remove_library'
  | 'update_library'
  | 'share';

export interface IBookActivity extends Document {
  bookId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  activityType: BookActivityType;
  chapterType?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  sourceUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const BookActivitySchema = new Schema<IBookActivity>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ReadingSession', index: true },
    activityType: {
      type: String,
      enum: ['visit', 'read', 'rate', 'review', 'vote', 'add_library', 'remove_library', 'update_library', 'share'],
      required: true,
      index: true,
    },
    chapterType: { type: String, index: true },
    chapterNumber: { type: Number, index: true },
    chapterTitle: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

BookActivitySchema.index({ bookId: 1, activityType: 1, createdAt: -1 });
BookActivitySchema.index({ userId: 1, createdAt: -1 });

export const BookActivity = mongoose.model<IBookActivity>('BookActivity', BookActivitySchema);

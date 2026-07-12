import mongoose, { Schema, Document } from 'mongoose';

export interface IBookVisit extends Document {
  bookId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  unitNumber: number;
  unitType?: string;
  unitTitle: string;
  sourceUrl: string;
  openedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookVisitSchema = new Schema<IBookVisit>({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'ReadingSession', index: true },
  unitNumber: { type: Number, required: true, index: true },
  unitType: { type: String, default: 'chapter' },
  unitTitle: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  openedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

BookVisitSchema.index({ userId: 1, bookId: 1, openedAt: -1 });
BookVisitSchema.index({ userId: 1, sessionId: 1, openedAt: -1 });

export const BookVisit = mongoose.model<IBookVisit>('BookVisit', BookVisitSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IReadingSession extends Document {
  bookId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate?: Date;
  unitsRead: number;
  notes: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReadingSessionSchema = new Schema<IReadingSession>({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  unitsRead: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  completed: { type: Boolean, default: false },
}, { timestamps: true });

export const ReadingSession = mongoose.model<IReadingSession>('ReadingSession', ReadingSessionSchema);

import mongoose, { Schema, Document } from 'mongoose';

export type BookRequestStatus = 'open' | 'in_progress' | 'completed' | 'declined';

export interface IBookRequest extends Document {
  title: string;
  description: string;
  requestedByUserId: mongoose.Types.ObjectId;
  status: BookRequestStatus;
  votes: number;
  createdAt: Date;
  updatedAt: Date;
}

const BookRequestSchema = new Schema<IBookRequest>(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    requestedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'completed', 'declined'],
      default: 'open',
      index: true,
    },
    votes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

BookRequestSchema.index({ status: 1, votes: -1, createdAt: -1 });

export const BookRequest = mongoose.model<IBookRequest>('BookRequest', BookRequestSchema);

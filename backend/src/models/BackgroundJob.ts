import mongoose, { Schema, Document } from 'mongoose';

export type JobType = 'scrape_metadata' | 'scrape_units' | 'scrape_raw_metadata' | 'scrape_raw_units';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'requires_manual_intervention';

export interface IBackgroundJob extends Document {
  bookId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: JobType;
  status: JobStatus;
  progress: {
    current: number;
    total: number;
    message: string;
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
    url?: string;
    unitNumber?: number;
    sourceKind?: 'translated' | 'raw';
  };
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BackgroundJobSchema = new Schema<IBackgroundJob>({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['scrape_metadata', 'scrape_units', 'scrape_raw_metadata', 'scrape_raw_units'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'requires_manual_intervention'], default: 'pending', index: true },
  progress: {
    current: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    message: { type: String, default: '' }
  },
  error: {
    message: { type: String },
    stack: { type: String },
    code: { type: String },
    url: { type: String },
    unitNumber: { type: Number },
    sourceKind: { type: String, enum: ['translated', 'raw'] }
  },
  retryCount: { type: Number, default: 0 },
  startedAt: { type: Date },
  completedAt: { type: Date },
  failedAt: { type: Date }
}, { timestamps: true });

export const BackgroundJob = mongoose.model<IBackgroundJob>('BackgroundJob', BackgroundJobSchema);

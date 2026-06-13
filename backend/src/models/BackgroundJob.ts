import mongoose, { Schema, Document } from 'mongoose';

export type JobType = 'scrape_metadata' | 'scrape_chapters' | 'scrape_raw_metadata' | 'scrape_raw_chapters';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IBackgroundJob extends Document {
  novelId: mongoose.Types.ObjectId;
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
  };
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BackgroundJobSchema = new Schema<IBackgroundJob>({
  novelId: { type: Schema.Types.ObjectId, ref: 'Novel', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['scrape_metadata', 'scrape_chapters', 'scrape_raw_metadata', 'scrape_raw_chapters'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
  progress: {
    current: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    message: { type: String, default: '' }
  },
  error: {
    message: { type: String },
    stack: { type: String }
  },
  retryCount: { type: Number, default: 0 },
  startedAt: { type: Date },
  completedAt: { type: Date },
  failedAt: { type: Date }
}, { timestamps: true });

export const BackgroundJob = mongoose.model<IBackgroundJob>('BackgroundJob', BackgroundJobSchema);

import mongoose, { Schema, Document } from 'mongoose';

export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
export type ReportReason =
  | 'spam'
  | 'inappropriate_content'
  | 'copyright'
  | 'incorrect_metadata'
  | 'other';

export interface IReport extends Document {
  bookId: mongoose.Types.ObjectId;
  reporterUserId: mongoose.Types.ObjectId;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    reporterUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate_content', 'copyright', 'incorrect_metadata', 'other'],
      required: true,
    },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
  },
  { timestamps: true }
);

ReportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model<IReport>('Report', ReportSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IBookStats extends Document {
  bookId: mongoose.Types.ObjectId;
  totalVisits: number;
  totalUniqueVisitors: number;
  totalReadingSessions: number;
  totalChaptersRead: number;
  totalVotes: number;
  ratingCount: number;
  ratingSum: number;
  ratingAverage: number;
  reviewCount: number;
  lastUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookStatsSchema = new Schema<IBookStats>({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true, unique: true },
  totalVisits: { type: Number, default: 0 },
  totalUniqueVisitors: { type: Number, default: 0 },
  totalReadingSessions: { type: Number, default: 0 },
  totalChaptersRead: { type: Number, default: 0 },
  totalVotes: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  ratingSum: { type: Number, default: 0 },
  ratingAverage: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  lastUpdatedAt: { type: Date },
}, { timestamps: true });

BookStatsSchema.pre('save', function updateRatingAverage(next) {
  if (this.ratingCount > 0) {
    this.ratingAverage = this.ratingSum / this.ratingCount;
  } else {
    this.ratingAverage = 0;
  }
  this.lastUpdatedAt = new Date();
  next();
});

export const BookStats = mongoose.model<IBookStats>('BookStats', BookStatsSchema);

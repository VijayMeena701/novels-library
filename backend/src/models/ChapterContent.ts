import mongoose, { Schema, Document } from 'mongoose';

export interface IBookContent extends Document {
  bookId: mongoose.Types.ObjectId;
  unitNumber: number;
  unitType?: string;
  title: string;
  content: string;
  sourceUrl: string;
  scrapedAt: Date;
}

const BookContentSchema = new Schema<IBookContent>({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  unitNumber: { type: Number, required: true },
  unitType: { type: String, default: 'chapter' },
  title: { type: String, default: '' },
  content: { type: String, required: true },
  sourceUrl: { type: String, default: '' },
  scrapedAt: { type: Date, default: Date.now }
});

// Ensure uniqueness of unit number per book
BookContentSchema.index({ bookId: 1, unitNumber: 1 }, { unique: true });

export const BookContent = mongoose.model<IBookContent>('BookContent', BookContentSchema);

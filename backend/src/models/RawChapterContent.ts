import mongoose, { Schema, Document } from 'mongoose';

export interface IRawBookContent extends Document {
  bookId: mongoose.Types.ObjectId;
  unitNumber: number;
  unitType?: string;
  title: string;
  content: string;
  sourceUrl: string;
  language: string;
  scrapedAt: Date;
}

const RawBookContentSchema = new Schema<IRawBookContent>({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  unitNumber: { type: Number, required: true },
  unitType: { type: String, default: 'chapter' },
  title: { type: String, default: '' },
  content: { type: String, required: true },
  sourceUrl: { type: String, default: '' },
  language: { type: String, default: '' },
  scrapedAt: { type: Date, default: Date.now },
});

RawBookContentSchema.index({ bookId: 1, unitNumber: 1 }, { unique: true });

export const RawBookContent = mongoose.model<IRawBookContent>('RawBookContent', RawBookContentSchema);

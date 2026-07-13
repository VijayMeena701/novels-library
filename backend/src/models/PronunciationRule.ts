import mongoose, { Schema, Document } from 'mongoose';

export interface IPronunciationRule extends Document {
  userId: mongoose.Types.ObjectId;
  bookId?: mongoose.Types.ObjectId | null;
  isGlobal: boolean;
  pattern: string;
  replacement: string;
  wholeWord: boolean;
  caseSensitive: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PronunciationRuleSchema = new Schema<IPronunciationRule>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', default: null, index: true },
    isGlobal: { type: Boolean, default: false },
    pattern: { type: String, required: true, trim: true, maxlength: 200 },
    replacement: { type: String, default: '', trim: true, maxlength: 500 },
    wholeWord: { type: Boolean, default: true },
    caseSensitive: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

PronunciationRuleSchema.index({ userId: 1, bookId: 1 });
PronunciationRuleSchema.index({ userId: 1, isGlobal: 1 });

export const PronunciationRule = mongoose.model<IPronunciationRule>('PronunciationRule', PronunciationRuleSchema);

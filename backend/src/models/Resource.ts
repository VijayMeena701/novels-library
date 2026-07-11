import mongoose, { Schema, Document } from 'mongoose';

export interface IResource extends Document {
  key: string;
  name: string;
  description: string;
  actions: mongoose.Types.ObjectId[];
  isEnabled: boolean;
  isSystem: boolean;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSchema = new Schema<IResource>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    actions: [{ type: Schema.Types.ObjectId, ref: 'Action', index: true }],
    isEnabled: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    category: { type: String, default: 'general' },
  },
  { timestamps: true }
);

export const Resource = mongoose.model<IResource>('Resource', ResourceSchema);

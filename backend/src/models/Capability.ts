import mongoose, { Schema, Document } from 'mongoose';

export interface ICapability extends Document {
  key: string;
  name: string;
  description: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

const CapabilitySchema = new Schema<ICapability>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'general' },
  },
  { timestamps: true }
);

export const Capability = mongoose.model<ICapability>('Capability', CapabilitySchema);

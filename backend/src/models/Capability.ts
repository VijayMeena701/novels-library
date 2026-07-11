import mongoose, { Schema, Document } from 'mongoose';

export interface ICapability extends Document {
  resource: mongoose.Types.ObjectId;
  action: mongoose.Types.ObjectId;
  category: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CapabilitySchema = new Schema<ICapability>(
  {
    resource: { type: Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
    action: { type: Schema.Types.ObjectId, ref: 'Action', required: true, index: true },
    category: { type: String, default: 'general' },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CapabilitySchema.index({ resource: 1, action: 1 }, { unique: true });

export const Capability = mongoose.model<ICapability>('Capability', CapabilitySchema);

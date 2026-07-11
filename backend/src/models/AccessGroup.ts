import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessGroup extends Document {
  key: string;
  name: string;
  description: string;
  resource?: mongoose.Types.ObjectId;
  capabilities: mongoose.Types.ObjectId[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccessGroupSchema = new Schema<IAccessGroup>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    resource: { type: Schema.Types.ObjectId, ref: 'Resource', index: true },
    capabilities: [{ type: Schema.Types.ObjectId, ref: 'Capability', index: true }],
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AccessGroup = mongoose.model<IAccessGroup>('AccessGroup', AccessGroupSchema);

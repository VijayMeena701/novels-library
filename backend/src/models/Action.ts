import mongoose, { Schema, Document } from 'mongoose';

export interface IAction extends Document {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ActionSchema = new Schema<IAction>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Action = mongoose.model<IAction>('Action', ActionSchema);

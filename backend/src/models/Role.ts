import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  key: string;
  name: string;
  description: string;
  groups: mongoose.Types.ObjectId[];
  isSuperuser: boolean;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    groups: [{ type: Schema.Types.ObjectId, ref: 'AccessGroup', index: true }],
    isSuperuser: { type: Boolean, default: false },
    isSystem: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Role = mongoose.model<IRole>('Role', RoleSchema);

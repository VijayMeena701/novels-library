import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  googleId: string;
  authProvider: 'password' | 'google' | 'both';
  roles: mongoose.Types.ObjectId[];
  avatarUrl: string;
  isDisabled: boolean;
  isDeleted: boolean;
  isVerified: boolean;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, default: '' },
    googleId: { type: String, default: '', index: true },
    authProvider: { type: String, enum: ['password', 'google', 'both'], default: 'password' },
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role', index: true }],
    avatarUrl: { type: String, default: '' },
    isDisabled: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    isVerified: { type: Boolean, default: false, index: true },
    isLocked: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>('User', UserSchema);

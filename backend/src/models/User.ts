import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  googleId: string;
  authProvider: 'password' | 'google' | 'both';
  role: 'user' | 'admin';
  avatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, default: '' },
  googleId: { type: String, default: '', index: true },
  authProvider: { type: String, enum: ['password', 'google', 'both'], default: 'password' },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  avatarUrl: { type: String, default: '' },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);

import mongoose, { Schema } from 'mongoose';

export interface IAppConfig {
  name: string;
  value: unknown;
  description: string;
  updatedAt: Date;
  createdAt: Date;
}

const AppConfigSchema = new Schema<IAppConfig>(
  {
    name: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, default: null },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

export const AppConfig = mongoose.model<IAppConfig>('AppConfig', AppConfigSchema);

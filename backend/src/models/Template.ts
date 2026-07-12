import mongoose, { Schema } from 'mongoose';

export type TemplateType = 'email' | 'sms' | 'push' | 'webhook';

export interface ITemplate {
  key: string;
  subject: string;
  body: string;
  type: TemplateType;
  variables: string[];
  updatedAt: Date;
  createdAt: Date;
}

const TemplateSchema = new Schema<ITemplate>(
  {
    key: { type: String, required: true, unique: true, index: true },
    subject: { type: String, default: '' },
    body: { type: String, required: true },
    type: { type: String, enum: ['email', 'sms', 'push', 'webhook'], default: 'email' },
    variables: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Template = mongoose.model<ITemplate>('Template', TemplateSchema);

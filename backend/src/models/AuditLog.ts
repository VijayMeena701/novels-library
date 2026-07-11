import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  role?: string;
  email?: string;
  action: string;
  method: string;
  path: string;
  resourceType?: string;
  resourceId?: string;
  statusCode?: number;
  outcome: 'allowed' | 'denied' | 'error';
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, index: true },
    role: { type: String, index: true },
    email: { type: String },
    action: { type: String, required: true, index: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    resourceType: { type: String },
    resourceId: { type: String, index: true },
    statusCode: { type: Number },
    outcome: { type: String, enum: ['allowed', 'denied', 'error'], required: true, index: true },
    ip: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ outcome: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

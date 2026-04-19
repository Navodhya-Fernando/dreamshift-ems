import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType = 'assignment' | 'mention' | 'deadline' | 'system';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['assignment', 'mention', 'deadline', 'system'],
      default: 'system',
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models?.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

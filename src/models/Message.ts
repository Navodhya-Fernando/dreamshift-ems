import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  conversationId?: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  recipientIds?: mongoose.Types.ObjectId[];
  content: string;
  status?: 'SENT' | 'DELIVERED' | 'READ';
  readAt?: Date | null;
  deliveredAt?: Date | null;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  replyToMessageId?: mongoose.Types.ObjectId | null;
  reactions?: Array<{ emoji: string; userId: mongoose.Types.ObjectId; createdAt?: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientIds: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    content: { type: String, required: true, trim: true },
    status: { type: String, enum: ['SENT', 'DELIVERED', 'READ'], default: 'SENT', index: true },
    readAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    replyToMessageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

MessageSchema.index({ senderId: 1, recipientId: 1, createdAt: 1 });
MessageSchema.index({ recipientId: 1, senderId: 1, createdAt: 1 });
MessageSchema.index({ conversationId: 1, createdAt: 1 });

export default mongoose.models?.Message || mongoose.model<IMessage>('Message', MessageSchema);
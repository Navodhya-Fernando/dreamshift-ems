import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  name?: string;
  isGroup: boolean;
  participantIds: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema: Schema = new Schema(
  {
    name: { type: String, trim: true },
    isGroup: { type: Boolean, default: false, index: true },
    participantIds: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

ConversationSchema.index({ participantIds: 1, updatedAt: -1 });

export default mongoose.models?.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);

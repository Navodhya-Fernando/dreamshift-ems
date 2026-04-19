import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  entityType?: 'project' | 'task';
  entityId?: string;
  projectId?: mongoose.Types.ObjectId | string;
  taskId?: mongoose.Types.ObjectId | string;
  parentCommentId?: mongoose.Types.ObjectId;
  mentions?: mongoose.Types.ObjectId[];
  mentionHandles?: string[];
  reactions?: Array<{ emoji: string; userId: mongoose.Types.ObjectId; createdAt: Date }>;
  deletedAt?: Date;
  editedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema: Schema = new Schema(
  {
    entityType: { type: String, enum: ['project', 'task'] },
    entityId: { type: String },
    projectId: { type: Schema.Types.Mixed, ref: 'Project' },
    taskId: { type: Schema.Types.Mixed, ref: 'Task' },
    parentCommentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    mentionHandles: [{ type: String }],
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    deletedAt: { type: Date },
    editedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models?.Comment || mongoose.model<IComment>('Comment', CommentSchema);

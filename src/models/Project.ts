import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description?: string;
  deadline?: Date;
  taskTemplate?: string;
  workspaceId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    deadline: { type: Date },
    taskTemplate: { type: String, default: 'NO_TEMPLATE' },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.models?.Project || mongoose.model<IProject>('Project', ProjectSchema);

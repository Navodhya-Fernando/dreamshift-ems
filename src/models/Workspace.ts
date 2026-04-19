import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkspace extends Document {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.models?.Workspace || mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);

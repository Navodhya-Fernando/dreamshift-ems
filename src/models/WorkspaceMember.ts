import mongoose, { Schema, Document } from 'mongoose';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'WORKSPACE_ADMIN' | 'EMPLOYEE';

export interface IWorkspaceMember extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema: Schema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { 
      type: String, 
      enum: ['OWNER', 'ADMIN', 'WORKSPACE_ADMIN', 'EMPLOYEE'], 
      default: 'EMPLOYEE' 
    },
  },
  { timestamps: true }
);

export default mongoose.models?.WorkspaceMember || mongoose.model<IWorkspaceMember>('WorkspaceMember', WorkspaceMemberSchema);

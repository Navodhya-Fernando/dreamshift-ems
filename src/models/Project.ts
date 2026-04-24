import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description?: string;
  deadline?: Date;
  status: 'ACTIVE' | 'CLOSED';
  startDate?: Date;
  endDate?: Date;
  taskStatuses: { key: string; label: string }[];
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
    status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
    startDate: { type: Date },
    endDate: { type: Date },
    taskStatuses: {
      type: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
        },
      ],
      default: [
        { key: 'TODO', label: 'To Do' },
        { key: 'IN_PROGRESS', label: 'In Progress' },
        { key: 'IN_REVIEW', label: 'In Review' },
        { key: 'BLOCKED', label: 'Blocked' },
        { key: 'DONE', label: 'Done' },
      ],
    },
    taskTemplate: { type: String, default: 'NO_TEMPLATE' },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.models?.Project || mongoose.model<IProject>('Project', ProjectSchema);

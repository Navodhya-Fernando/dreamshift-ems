import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  title: string;
  description?: string;
  status: string;
  projectId: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId?: mongoose.Types.ObjectId;
  assigneeIds?: mongoose.Types.ObjectId[];
  dueDate?: Date;
  startDate?: Date;
  endDate?: Date;
  timeSpent: number; // in seconds
  subtasks: { title: string; isCompleted: boolean; dueDate?: Date }[];
  attachments: string[]; // URLs
  extensionRequested?: {
    proposedDate: Date;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  };
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { 
      type: String, 
      default: 'TODO' 
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM'
    },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
    assigneeIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    dueDate: { type: Date, required: false },
    startDate: { type: Date, required: false },
    endDate: { type: Date, required: false },
    timeSpent: { type: Number, default: 0 },
    subtasks: [
      {
        title: { type: String, required: true },
        isCompleted: { type: Boolean, default: false },
        dueDate: { type: Date, required: false }
      }
    ],
    attachments: [{ type: String }],
    extensionRequested: {
      proposedDate: { type: Date },
      reason: { type: String },
      status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'] }
    }
  },
  { timestamps: true }
);

export default mongoose.models?.Task || mongoose.model<ITask>('Task', TaskSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface ITimeEntry extends Document {
  userId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  source: 'MANUAL' | 'TIMER';
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TimeEntrySchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    source: { type: String, enum: ['MANUAL', 'TIMER'], default: 'TIMER', index: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationSeconds: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models?.TimeEntry || mongoose.model<ITimeEntry>('TimeEntry', TimeEntrySchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface ITaskTemplate extends Document {
  key: string;
  title: string;
  description?: string;
  steps: string[];
  ownerId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskTemplateSchema: Schema = new Schema(
  {
    key: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    steps: { type: [String], default: [] },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

TaskTemplateSchema.index({ ownerId: 1, key: 1 }, { unique: true });

export default mongoose.models?.TaskTemplate || mongoose.model<ITaskTemplate>('TaskTemplate', TaskTemplateSchema);

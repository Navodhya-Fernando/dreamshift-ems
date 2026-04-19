import mongoose, { Schema, Document } from 'mongoose';
import type { PlatformRole } from '@/lib/roles';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  image?: string;
  designation?: string;
  contractExpiry?: Date;
  role: PlatformRole;
  dateJoined?: Date;
  employmentStatus?: 'ACTIVE' | 'LEFT';
  leftAt?: Date;
  leftReason?: string;
  employmentHistory?: Array<{
    title: string;
    startedAt: Date;
    endedAt?: Date;
    note?: string;
  }>;
  linkedinProfileUrl?: string;
  linkedinProfilePicUrl?: string;
  notificationPreferences?: {
    emailNotifications: boolean;
    taskReminders: boolean;
    deadlineAlerts: boolean;
    weeklyDigest: boolean;
    messageNotifications: boolean;
  };
  appearancePreferences?: {
    theme: 'SYSTEM' | 'LIGHT' | 'DARK';
    density: 'COMFORTABLE' | 'COMPACT';
    reduceMotion: boolean;
  };
  presenceStatus?: 'ONLINE' | 'AWAY' | 'OFFLINE';
  lastSeenAt?: Date;
  activeAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    image: { type: String },
    designation: { type: String },
    contractExpiry: { type: Date },
    role: {
      type: String,
      enum: ['EMPLOYEE', 'WORKSPACE_ADMIN', 'ADMIN', 'Admin', 'OWNER'],
      default: 'EMPLOYEE',
    },
    dateJoined: { type: Date },
    employmentStatus: {
      type: String,
      enum: ['ACTIVE', 'LEFT'],
      default: 'ACTIVE',
    },
    leftAt: { type: Date },
    leftReason: { type: String, trim: true },
    employmentHistory: {
      type: [
        {
          title: { type: String, required: true, trim: true },
          startedAt: { type: Date, required: true },
          endedAt: { type: Date },
          note: { type: String, trim: true },
        },
      ],
      default: [],
    },
    linkedinProfileUrl: { type: String },
    linkedinProfilePicUrl: { type: String },
    notificationPreferences: {
      type: {
        emailNotifications: { type: Boolean, default: true },
        taskReminders: { type: Boolean, default: true },
        deadlineAlerts: { type: Boolean, default: true },
        weeklyDigest: { type: Boolean, default: false },
        messageNotifications: { type: Boolean, default: true },
      },
      default: {
        emailNotifications: true,
        taskReminders: true,
        deadlineAlerts: true,
        weeklyDigest: false,
        messageNotifications: true,
      },
    },
    appearancePreferences: {
      type: {
        theme: {
          type: String,
          enum: ['SYSTEM', 'LIGHT', 'DARK'],
          default: 'SYSTEM',
        },
        density: {
          type: String,
          enum: ['COMFORTABLE', 'COMPACT'],
          default: 'COMFORTABLE',
        },
        reduceMotion: { type: Boolean, default: false },
      },
      default: {
        theme: 'SYSTEM',
        density: 'COMFORTABLE',
        reduceMotion: false,
      },
    },
    presenceStatus: {
      type: String,
      enum: ['ONLINE', 'AWAY', 'OFFLINE'],
      default: 'OFFLINE',
    },
    lastSeenAt: { type: Date },
    activeAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models?.User || mongoose.model<IUser>('User', UserSchema);

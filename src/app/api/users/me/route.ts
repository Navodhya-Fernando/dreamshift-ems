import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';
import Task from '@/models/Task';
import Comment from '@/models/Comment';

function buildAssigneeFilter(user: { _id: string; email?: string | null; name?: string | null }) {
  const matchers: Array<Record<string, unknown>> = [
    { assigneeId: user._id },
    { assigneeId: mongoose.isValidObjectId(user._id) ? new mongoose.Types.ObjectId(user._id) : user._id },
    { assigneeIds: user._id },
    { assigneeIds: mongoose.isValidObjectId(user._id) ? new mongoose.Types.ObjectId(user._id) : user._id },
  ];
  if (user.email) {
    matchers.push({ assignee: user.email });
    matchers.push({ assignee: user.email.toLowerCase() });
  }
  if (user.name) matchers.push({ assignee: user.name });
  return { $or: matchers };
}

function normalizeStatus(status?: string) {
  const upper = String(status || 'TODO').toUpperCase().replace(/\s+/g, '_');
  if (upper === 'COMPLETED') return 'DONE';
  if (upper === 'TO_DO') return 'TODO';
  if (upper === 'INPROGRESS') return 'IN_PROGRESS';
  return upper;
}

function getDateValue(task: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = task[key];
    if (!value) continue;
    const date = new Date(value as string | Date);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

type EmploymentHistoryRaw = {
  title?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  note?: unknown;
};

type EmploymentHistoryNormalized = {
  title: string;
  startedAt: Date;
  endedAt: Date | null;
  note: string;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as { id: string }).id;

    const user = await User.findById(userId, {
      name: 1,
      email: 1,
      image: 1,
      designation: 1,
      role: 1,
      dateJoined: 1,
      employmentHistory: 1,
      contractExpiry: 1,
      linkedinProfileUrl: 1,
      linkedinProfilePicUrl: 1,
      notificationPreferences: 1,
      appearancePreferences: 1,
      createdAt: 1,
    }).lean();

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const contractRemainingDays = user.contractExpiry
      ? Math.max(0, Math.ceil((new Date(user.contractExpiry).getTime() - Date.now()) / 86400000))
      : null;

    const fallbackStart = user.dateJoined || user.createdAt || new Date();
    const currentTitle = String(user.designation || 'Employee');
    const normalizedEmploymentHistory = Array.isArray(user.employmentHistory) && user.employmentHistory.length > 0
      ? (user.employmentHistory as EmploymentHistoryRaw[])
          .map((entry: EmploymentHistoryRaw): EmploymentHistoryNormalized => ({
            title: String(entry.title || '').trim(),
            startedAt: new Date(entry.startedAt as string | Date),
            endedAt: entry.endedAt ? new Date(entry.endedAt as string | Date) : null,
            note: entry.note ? String(entry.note) : '',
          }))
          .filter((entry: EmploymentHistoryNormalized) => entry.title && !Number.isNaN(entry.startedAt.getTime()))
          .sort((left: EmploymentHistoryNormalized, right: EmploymentHistoryNormalized) => left.startedAt.getTime() - right.startedAt.getTime())
      : [
          {
            title: currentTitle,
            startedAt: new Date(fallbackStart),
            endedAt: null,
            note: '',
          },
        ];

    const [memberships, assignedTasks, recentComments] = await Promise.all([
      WorkspaceMember.find({ userId }).populate('workspaceId', 'name').lean(),
      Task.collection.find(buildAssigneeFilter({ _id: userId, email: user.email ?? undefined, name: user.name ?? undefined })).sort({ updatedAt: -1, created_at: -1 }).limit(30).toArray(),
      Comment.find({ userId }).populate('taskId', 'title').sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    const done = assignedTasks.filter((task) => task.status === 'DONE').length;
    const totalSeconds = assignedTasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
    const overdue = assignedTasks.filter((task) => {
      const due = getDateValue(task as Record<string, unknown>, ['dueDate', 'due_date']);
      return Boolean(due && normalizeStatus(task.status) !== 'DONE' && due.getTime() < Date.now());
    }).length;
    const dueNext7 = assignedTasks.filter((task) => {
      const due = getDateValue(task as Record<string, unknown>, ['dueDate', 'due_date']);
      return Boolean(due && normalizeStatus(task.status) !== 'DONE' && due.getTime() >= Date.now() && due.getTime() <= Date.now() + 7 * 86400000);
    }).length;

    const trendSeed = new Map<string, number>();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - offset);
      trendSeed.set(dayKey(day), 0);
    }
    assignedTasks.forEach((task) => {
      if (normalizeStatus(task.status) !== 'DONE') return;
      const completedAt = getDateValue(task as Record<string, unknown>, ['endDate', 'end_date', 'updatedAt', 'createdAt', 'created_at']);
      if (!completedAt) return;
      const key = dayKey(completedAt);
      if (trendSeed.has(key)) trendSeed.set(key, (trendSeed.get(key) || 0) + 1);
    });

    const trend7 = Array.from(trendSeed.values());
    const statusBreakdown = {
      done,
      inProgress: assignedTasks.filter((task) => normalizeStatus(task.status) === 'IN_PROGRESS').length,
      todo: assignedTasks.filter((task) => normalizeStatus(task.status) === 'TODO').length,
      blocked: assignedTasks.filter((task) => normalizeStatus(task.status) === 'BLOCKED').length,
      inReview: assignedTasks.filter((task) => normalizeStatus(task.status) === 'IN_REVIEW').length,
    };

    const completionProbability = Math.max(5, Math.min(99, Math.round((done / Math.max(1, assignedTasks.length)) * 100 - overdue * 4 + 12)));
    const workloadPressure = Math.min(100, Math.round((statusBreakdown.todo + statusBreakdown.inProgress) * 8 + overdue * 14 + statusBreakdown.blocked * 16));
    const focusScore = Math.max(0, Math.min(100, 100 - workloadPressure));

    const activity = [
      ...assignedTasks.slice(0, 4).map((task) => ({
        id: `task-${task._id}`,
        msg: `Task \"${task.title}\" moved to ${String(task.status || 'TODO').replace('_', ' ').toLowerCase()}`,
        time: new Date(task.updatedAt || task.created_at || Date.now()).toISOString(),
        color: task.status === 'DONE' ? '#10B981' : task.status === 'BLOCKED' ? '#EF4444' : '#5B6BF8',
      })),
      ...recentComments.map((comment) => ({
        id: `comment-${comment._id}`,
        msg: `Commented on \"${(comment.taskId as { title?: string })?.title || 'task'}\"`,
        time: new Date(comment.createdAt).toISOString(),
        color: '#F59E0B',
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 6);

    return NextResponse.json(
      {
        success: true,
        data: {
          user,
          contractRemainingDays,
          stats: {
            totalTasks: assignedTasks.length,
            doneTasks: done,
            completionRate: assignedTasks.length ? Math.round((done / assignedTasks.length) * 100) : 0,
            trackedHours: Number((totalSeconds / 3600).toFixed(1)),
            workspaces: memberships.length,
          },
          analytics: {
            trend7,
            statusBreakdown,
            overdue,
            dueNext7,
            completionProbability,
            workloadPressure,
            focusScore,
          },
          employmentHistory: normalizedEmploymentHistory,
          memberships: memberships.map((membership) => ({
            id: membership._id,
            role: membership.role,
            workspace: membership.workspaceId,
          })),
          activity,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const body = await req.json().catch(() => ({}));

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.email === 'string') {
      const email = body.email.trim().toLowerCase();
      if (!validEmail(email)) {
        return NextResponse.json({ success: false, error: 'Enter a valid email address' }, { status: 400 });
      }
      const existing = await User.findOne({ email, _id: { $ne: userId } }, { _id: 1 }).lean();
      if (existing) {
        return NextResponse.json({ success: false, error: 'Email address already in use' }, { status: 409 });
      }
      updates.email = email;
    }

    if (typeof body.linkedinProfileUrl === 'string') {
      updates.linkedinProfileUrl = body.linkedinProfileUrl.trim();
    }

    if (typeof body.linkedinProfilePicUrl === 'string') {
      updates.linkedinProfilePicUrl = body.linkedinProfilePicUrl.trim();
    }

    if (typeof body.designation === 'string') {
      updates.designation = body.designation.trim();
    }

    if (body.notificationPreferences && typeof body.notificationPreferences === 'object') {
      const input = body.notificationPreferences as Record<string, unknown>;
      const dailySummaryTime = String(input.dailySummaryTime || '07:45').trim();
      const dailySummaryTimezone = String(input.dailySummaryTimezone || 'Asia/Kolkata').trim() || 'Asia/Kolkata';
      updates.notificationPreferences = {
        emailNotifications: Boolean(input.emailNotifications),
        taskReminders: Boolean(input.taskReminders),
        deadlineAlerts: Boolean(input.deadlineAlerts),
        weeklyDigest: Boolean(input.weeklyDigest),
        dailySummaryTime: /^\d{2}:\d{2}$/.test(dailySummaryTime) ? dailySummaryTime : '07:45',
        dailySummaryTimezone,
        messageNotifications: Boolean(input.messageNotifications),
      };
    }

    if (body.appearancePreferences && typeof body.appearancePreferences === 'object') {
      const input = body.appearancePreferences as Record<string, unknown>;
      const theme = String(input.theme || 'SYSTEM').toUpperCase();
      const density = String(input.density || 'COMFORTABLE').toUpperCase();

      if (!['SYSTEM', 'LIGHT', 'DARK'].includes(theme)) {
        return NextResponse.json({ success: false, error: 'Invalid theme option' }, { status: 400 });
      }
      if (!['COMFORTABLE', 'COMPACT'].includes(density)) {
        return NextResponse.json({ success: false, error: 'Invalid density option' }, { status: 400 });
      }

      updates.appearancePreferences = {
        theme,
        density,
        reduceMotion: Boolean(input.reduceMotion),
      };
    }

    if (body.newPassword || body.currentPassword || body.confirmPassword) {
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      const confirmPassword = String(body.confirmPassword || '');

      if (!currentPassword || !newPassword || !confirmPassword) {
        return NextResponse.json({ success: false, error: 'Complete all password fields' }, { status: 400 });
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, error: 'New password must be at least 8 characters' }, { status: 400 });
      }
      if (newPassword !== confirmPassword) {
        return NextResponse.json({ success: false, error: 'Password confirmation does not match' }, { status: 400 });
      }

      const passwordHash = String(user.password || '');
      const ok = passwordHash ? await bcrypt.compare(currentPassword, passwordHash) : false;
      if (!ok) {
        return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 403 });
      }

      updates.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No changes provided' }, { status: 400 });
    }

    await User.updateOne({ _id: userId }, { $set: updates });

    const refreshed = await User.findById(userId, {
      name: 1,
      email: 1,
      image: 1,
      designation: 1,
      role: 1,
      dateJoined: 1,
      contractExpiry: 1,
      linkedinProfileUrl: 1,
      linkedinProfilePicUrl: 1,
      notificationPreferences: 1,
      appearancePreferences: 1,
      dailySummaryLastScheduledFor: 1,
    }).lean();

    return NextResponse.json({ success: true, data: { user: refreshed } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

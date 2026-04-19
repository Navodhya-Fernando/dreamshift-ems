import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongoose';
import { normalizePlatformRole } from '@/lib/roles';
import { hasAdminAccess } from '@/lib/roles.server';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';
import Workspace from '@/models/Workspace';
import Task from '@/models/Task';

type AnyRecord = Record<string, unknown>;

function normalizeEmploymentStatus(value?: unknown) {
  return String(value || 'ACTIVE').trim().toUpperCase().replace(/[\s-]+/g, '_') === 'LEFT' ? 'LEFT' : 'ACTIVE';
}

function parseFlexibleDate(value?: unknown) {
  if (value === undefined || value === null || value === '') return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const parsed = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const displayMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (displayMatch) {
    const parsed = new Date(Date.UTC(Number(displayMatch[3]), Number(displayMatch[2]) - 1, Number(displayMatch[1])));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateOrUndefined(value?: unknown) {
  return parseFlexibleDate(value) || undefined;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getDateValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (!value) continue;
    const date = new Date(value as string | Date);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function normalizeTaskStatus(value?: string | null) {
  const normalized = String(value || 'TODO').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'COMPLETED') return 'DONE';
  if (normalized === 'TO_DO') return 'TODO';
  if (normalized === 'INPROGRESS') return 'IN_PROGRESS';
  return normalized;
}

function normalizeEmploymentHistory(value?: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry: AnyRecord) => {
      const title = String(entry.title || '').trim();
      const startedAt = parseFlexibleDate(entry.startedAt);
      const endedAt = parseFlexibleDate(entry.endedAt);

      if (!title || !startedAt || Number.isNaN(startedAt.getTime())) return null;

      return {
        title,
        startedAt,
        endedAt: endedAt && !Number.isNaN(endedAt.getTime()) ? endedAt : undefined,
        note: String(entry.note || '').trim(),
      };
    })
    .filter(Boolean) as Array<{ title: string; startedAt: Date; endedAt?: Date; note?: string }>;
}

function buildAssigneeFilter(user: { _id: unknown; email?: string | null; name?: string | null }) {
  const matchers: Array<Record<string, unknown>> = [
    { assigneeId: user._id },
    { assigneeId: mongoose.isValidObjectId(String(user._id)) ? new mongoose.Types.ObjectId(String(user._id)) : user._id },
  ];
  if (user.email) {
    matchers.push({ assignee: user.email });
    matchers.push({ assignee: user.email.toLowerCase() });
  }
  if (user.name) matchers.push({ assignee: user.name });
  return { $or: matchers };
}

async function canAdminAccess(session: { user?: { id?: string } } | null | undefined) {
  return session?.user?.id ? hasAdminAccess(session.user.id) : false;
}

async function getUserDetail(id: string) {
  const user = await User.findById(id, { password: 0 }).lean();
  if (!user) return null;

  const [memberships, allWorkspaces] = await Promise.all([
    WorkspaceMember.find({ userId: id }).lean(),
    Workspace.find({}, { name: 1 }).lean(),
  ]);

  const workspaceById = new Map(allWorkspaces.map((workspace) => [String(workspace._id), workspace]));
  const taskQuery = buildAssigneeFilter(user as { _id: unknown; email?: string | null; name?: string | null });
  const assignedTasks = await Task.collection.find(taskQuery).toArray();
  const done = assignedTasks.filter((task) => normalizeTaskStatus(task.status) === 'DONE').length;
  const overdueTasks = assignedTasks.filter((task) => {
    const due = getDateValue(task as Record<string, unknown>, ['dueDate', 'due_date']);
    return Boolean(due && normalizeTaskStatus(task.status) !== 'DONE' && due.getTime() < Date.now());
  }).length;
  const workspaceNames = Array.from(
    new Set(
      memberships
        .map((membership) => workspaceById.get(String(membership.workspaceId || ''))?.name)
        .filter((workspaceName): workspaceName is string => Boolean(workspaceName))
    )
  );
  const contractRemainingDays = user.contractExpiry
    ? Math.max(0, Math.ceil((new Date(user.contractExpiry as string | Date).getTime() - Date.now()) / 86400000))
    : null;

  return {
    ...user,
    role: normalizePlatformRole(user.role),
    employmentStatus: normalizeEmploymentStatus((user as AnyRecord).employmentStatus),
    leftAt: (user as AnyRecord).leftAt || null,
    leftReason: String((user as AnyRecord).leftReason || ''),
    employmentHistory: normalizeEmploymentHistory((user as AnyRecord).employmentHistory),
    memberships: memberships.map((membership) => ({
      id: String(membership._id),
      role: String(membership.role || 'EMPLOYEE'),
      workspace: workspaceById.get(String(membership.workspaceId || '')) || { name: 'Workspace' },
    })),
    taskStats: {
      totalAssigned: assignedTasks.length,
      completed: done,
      completionRate: assignedTasks.length ? Math.round((done / assignedTasks.length) * 100) : 0,
      overdueTasks,
      openTasks: Math.max(0, assignedTasks.length - done),
      contractRemainingDays,
      workspaceCount: workspaceNames.length,
      workspaceNames,
    },
  };
}

async function updateUser(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();

    const canAccess = await canAdminAccess(session);
    if (!canAccess) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const existing = await User.findById(id).select('+password');
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const setPayload: Record<string, unknown> = {};
    const unsetPayload: Record<string, ''> = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      setPayload.name = body.name.trim();
    }

    if (typeof body.email === 'string') {
      const email = body.email.trim().toLowerCase();
      if (!validEmail(email)) {
        return NextResponse.json({ success: false, error: 'Enter a valid email address' }, { status: 400 });
      }
      const duplicate = await User.findOne({ email, _id: { $ne: id } }, { _id: 1 }).lean();
      if (duplicate) {
        return NextResponse.json({ success: false, error: 'Email already in use' }, { status: 409 });
      }
      setPayload.email = email;
    }

    if (typeof body.designation === 'string') {
      setPayload.designation = body.designation.trim();
    }

    if (body.contractExpiry !== undefined) {
      const contractExpiry = toDateOrUndefined(body.contractExpiry);
      if (contractExpiry) {
        setPayload.contractExpiry = contractExpiry;
      } else {
        unsetPayload.contractExpiry = '';
      }
    }

    if (typeof body.role === 'string') {
      setPayload.role = normalizePlatformRole(body.role);
    }

    if (body.dateJoined !== undefined) {
      const dateJoined = toDateOrUndefined(body.dateJoined);
      if (dateJoined) {
        setPayload.dateJoined = dateJoined;
      } else {
        unsetPayload.dateJoined = '';
      }
    }

    if (typeof body.linkedinProfileUrl === 'string') {
      setPayload.linkedinProfileUrl = body.linkedinProfileUrl.trim();
    }

    if (typeof body.linkedinProfilePicUrl === 'string') {
      const profilePic = body.linkedinProfilePicUrl.trim();
      setPayload.linkedinProfilePicUrl = profilePic;
      setPayload.image = profilePic;
    }

    if (body.employmentHistory !== undefined) {
      const history = normalizeEmploymentHistory(body.employmentHistory);
      if (history.length > 0) {
        setPayload.employmentHistory = history;
      } else {
        unsetPayload.employmentHistory = '';
      }
    }

    if (body.employmentStatus !== undefined) {
      const status = normalizeEmploymentStatus(body.employmentStatus);
      setPayload.employmentStatus = status;
      if (status === 'LEFT') {
        setPayload.leftAt = toDateOrUndefined(body.leftAt) || new Date();
        if (typeof body.leftReason === 'string') {
          setPayload.leftReason = body.leftReason.trim();
        }
      } else {
        unsetPayload.leftAt = '';
        unsetPayload.leftReason = '';
      }
    }

    if (typeof body.password === 'string' && body.password.trim()) {
      if (body.password.trim().length < 8) {
        return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      setPayload.password = await bcrypt.hash(body.password, 10);
    }

    if (Object.keys(setPayload).length === 0 && Object.keys(unsetPayload).length === 0) {
      return NextResponse.json({ success: false, error: 'No changes provided' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (Object.keys(setPayload).length > 0) update.$set = setPayload;
    if (Object.keys(unsetPayload).length > 0) update.$unset = unsetPayload;

    await User.collection.updateOne({ _id: existing._id }, update);
    const refreshed = await getUserDetail(id);

    return NextResponse.json({ success: true, data: refreshed }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();

    const canAccess = await canAdminAccess(session);
    if (!canAccess) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const user = await getUserDetail(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  return updateUser(req, context);
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return updateUser(req, context);
}

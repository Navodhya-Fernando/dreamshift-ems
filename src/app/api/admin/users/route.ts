import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongoose';
import { normalizePlatformRole } from '@/lib/roles';
import { hasAdminAccess } from '@/lib/roles.server';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';
import Workspace from '@/models/Workspace';

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();

    const canAccess = await hasAdminAccess((session.user as { id: string }).id);
    if (!canAccess) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const [users, memberships, workspaces] = await Promise.all([
      User.find({}, { password: 0 }).sort({ createdAt: -1 }).lean(),
      WorkspaceMember.find({}).lean(),
      Workspace.find({}, { name: 1 }).lean(),
    ]);

    const workspaceById = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));
    const membershipsByUser = new Map<string, Array<{ id: string; name: string; role: string }>>();

    memberships.forEach((membership) => {
      const userKey = String(membership.userId || '');
      const workspace = workspaceById.get(String(membership.workspaceId || ''));
      if (!userKey) return;

      const next = membershipsByUser.get(userKey) || [];
      next.push({
        id: String(workspace?._id || membership.workspaceId),
        name: String(workspace?.name || 'Workspace'),
        role: String(membership.role || 'EMPLOYEE'),
      });
      membershipsByUser.set(userKey, next);
    });

    const payload = users.map((user) => {
      const workspacesForUser = membershipsByUser.get(String(user._id)) || [];
      return {
        ...user,
        role: normalizePlatformRole(user.role),
        employmentStatus: normalizeEmploymentStatus((user as AnyRecord).employmentStatus),
        leftAt: (user as AnyRecord).leftAt || null,
        leftReason: String((user as AnyRecord).leftReason || ''),
        workspaceCount: workspacesForUser.length,
        workspaces: workspacesForUser,
      };
    });

    return NextResponse.json({ success: true, data: payload }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();

    const canAccess = await hasAdminAccess((session.user as { id: string }).id);
    if (!canAccess) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const {
      name,
      email,
      password,
      designation,
      contractExpiry,
      role,
      dateJoined,
      linkedinProfileUrl,
      linkedinProfilePicUrl,
      employmentStatus,
      leftAt,
      leftReason,
      employmentHistory,
    } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 });
    }

    if (!password?.trim()) {
      return NextResponse.json({ success: false, error: 'Password is required for new accounts' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!validEmail(normalizedEmail)) {
      return NextResponse.json({ success: false, error: 'Enter a valid email address' }, { status: 400 });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 400 });
    }

    const normalizedStatus = normalizeEmploymentStatus(employmentStatus);
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      designation,
      contractExpiry: toDateOrUndefined(contractExpiry),
      role: normalizePlatformRole(role),
      dateJoined: toDateOrUndefined(dateJoined),
      employmentStatus: normalizedStatus,
      leftAt: normalizedStatus === 'LEFT' ? toDateOrUndefined(leftAt) || new Date() : undefined,
      leftReason: normalizedStatus === 'LEFT' ? String(leftReason || '').trim() : undefined,
      linkedinProfileUrl: String(linkedinProfileUrl || '').trim(),
      linkedinProfilePicUrl: String(linkedinProfilePicUrl || '').trim(),
      image: linkedinProfilePicUrl || undefined,
      employmentHistory: normalizeEmploymentHistory(employmentHistory),
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

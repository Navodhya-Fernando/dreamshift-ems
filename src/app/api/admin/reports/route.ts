import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import { normalizePlatformRole } from '@/lib/roles';
import { hasAdminAccess } from '@/lib/roles.server';
import Workspace from '@/models/Workspace';
import Project from '@/models/Project';
import Task from '@/models/Task';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';

type AnyRecord = Record<string, unknown>;

function buildProjectWorkspaceFilter(workspaceId: string, workspaceObjectId: mongoose.Types.ObjectId | null) {
  const objectIdString = workspaceObjectId ? String(workspaceObjectId) : '';
  return {
    $or: [
      { workspaceId },
      { workspace_id: workspaceId },
      ...(objectIdString ? [{ workspaceId: objectIdString }, { workspace_id: objectIdString }] : []),
      ...(workspaceObjectId ? [{ workspaceId: workspaceObjectId }, { workspace_id: workspaceObjectId }] : []),
    ],
  };
}

function buildTaskProjectFilter(projectIds: Array<string | { toString(): string }>) {
  const stringIds = projectIds.map((value) => String(value));
  return {
    $or: [
      { projectId: { $in: projectIds } },
      { projectId: { $in: stringIds } },
      { project_id: { $in: projectIds } },
      { project_id: { $in: stringIds } },
    ],
  };
}

function buildAssigneeFilter(user: { _id: unknown; email?: string | null; name?: string | null }) {
  const userId = String(user._id || '');
  const matchers: Array<Record<string, unknown>> = [
    { assigneeId: userId },
    { assigneeId: user._id },
    { assigneeId: mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : user._id },
    { assigneeIds: userId },
    { assigneeIds: mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : user._id },
  ];

  if (user.email) {
    matchers.push({ assignee: user.email });
    matchers.push({ assignee: user.email.toLowerCase() });
  }

  if (user.name) matchers.push({ assignee: user.name });
  return { $or: matchers };
}

function normalizeEmploymentStatus(value?: unknown) {
  return String(value || 'ACTIVE').trim().toUpperCase().replace(/[\s-]+/g, '_') === 'LEFT' ? 'LEFT' : 'ACTIVE';
}

function normalizeTaskStatus(value?: string | null) {
  const normalized = String(value || 'TODO').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'COMPLETED') return 'DONE';
  if (normalized === 'TO_DO') return 'TODO';
  if (normalized === 'INPROGRESS') return 'IN_PROGRESS';
  return normalized;
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

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseWindowDays(value: string | null) {
  const days = Number(value || 7);
  if (Number.isNaN(days)) return 7;
  if (days <= 0) return 0;
  if (days <= 7) return 7;
  if (days <= 30) return 30;
  return 90;
}

function getTaskActivityDate(task: Record<string, unknown>) {
  return getDateValue(task, ['updatedAt', 'updated_at', 'createdAt', 'created_at', 'dueDate', 'due_date']);
}

function inRange(date: Date | null, startMs: number, endMs: number) {
  if (!date) return false;
  const ts = date.getTime();
  return ts >= startMs && ts <= endMs;
}

function toScoreDelta(current: number, previous: number) {
  return Math.round((current - previous) * 10) / 10;
}

function dayStartMs(offsetFromToday: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetFromToday);
  return date.getTime();
}

function buildDailyCountTrend(tasks: AnyRecord[], predicate: (task: AnyRecord) => boolean, useDueDate = false) {
  const starts = Array.from({ length: 7 }, (_, index) => dayStartMs(index - 6));

  return starts.map((startMs, index) => {
    const endMs = index === starts.length - 1 ? dayStartMs(1) : starts[index + 1];
    return tasks.filter((task) => {
      const date = useDueDate
        ? getDateValue(task, ['dueDate', 'due_date'])
        : getTaskActivityDate(task);
      if (!date) return false;
      const ts = date.getTime();
      return ts >= startMs && ts < endMs && predicate(task);
    }).length;
  });
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();

    const canAccess = await hasAdminAccess((session.user as { id: string }).id);
    if (!canAccess) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const windowDays = parseWindowDays(url.searchParams.get('windowDays'));
    const now = Date.now();
    const windowMs = windowDays > 0 ? windowDays * 86400000 : 0;
    const currentStartMs = windowDays > 0 ? now - windowMs : Number.NEGATIVE_INFINITY;
    const currentEndMs = now;
    const previousStartMs = windowDays > 0 ? currentStartMs - windowMs : Number.NEGATIVE_INFINITY;
    const previousEndMs = windowDays > 0 ? currentStartMs : Number.POSITIVE_INFINITY;

    const [workspaces, users, memberships] = await Promise.all([
      Workspace.find({}).lean(),
      User.find({}, {
        name: 1,
        email: 1,
        designation: 1,
        role: 1,
        contractExpiry: 1,
        employmentStatus: 1,
        leftAt: 1,
        leftReason: 1,
        lastSeenAt: 1,
        presenceStatus: 1,
        createdAt: 1,
      }).lean(),
      WorkspaceMember.find({}).lean(),
    ]);

    const workspaceById = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));
    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const membershipsByWorkspace = new Map<string, Array<{ userId: string; role: string }>>();
    const membershipsByUser = new Map<string, Array<{ workspaceId: string; role: string }>>();

    memberships.forEach((membership) => {
      const workspaceId = String(membership.workspaceId || '');
      const userId = String(membership.userId || '');
      if (workspaceId) {
        const next = membershipsByWorkspace.get(workspaceId) || [];
        next.push({ userId, role: String(membership.role || 'EMPLOYEE') });
        membershipsByWorkspace.set(workspaceId, next);
      }
      if (userId) {
        const next = membershipsByUser.get(userId) || [];
        next.push({ workspaceId, role: String(membership.role || 'EMPLOYEE') });
        membershipsByUser.set(userId, next);
      }
    });

    const workspaceReportsDetailed = await Promise.all(
      workspaces.map(async (workspace: AnyRecord) => {
        const workspaceId = String(workspace._id);
        const workspaceObjectId = mongoose.isValidObjectId(workspaceId) ? new mongoose.Types.ObjectId(workspaceId) : null;
        const projects = await Project.collection.find(buildProjectWorkspaceFilter(workspaceId, workspaceObjectId)).toArray();
        const projectIds = projects.map((project) => project._id);
        const tasks = await Task.collection.find(buildTaskProjectFilter(projectIds)).toArray();
        const currentTasks = windowDays > 0
          ? tasks.filter((task) => inRange(getTaskActivityDate(task as Record<string, unknown>), currentStartMs, currentEndMs))
          : tasks;
        const previousTasks = windowDays > 0
          ? tasks.filter((task) => inRange(getTaskActivityDate(task as Record<string, unknown>), previousStartMs, previousEndMs))
          : tasks;
        const members = membershipsByWorkspace.get(workspaceId) || [];

        const done = currentTasks.filter((task) => normalizeTaskStatus(task.status) === 'DONE').length;
        const previousDone = previousTasks.filter((task) => normalizeTaskStatus(task.status) === 'DONE').length;
        const completionRate = currentTasks.length ? Math.round((done / currentTasks.length) * 100) : 0;
        const previousCompletionRate = previousTasks.length ? Math.round((previousDone / previousTasks.length) * 100) : 0;
        const overdueTasks = currentTasks.filter((task) => {
          const due = getDateValue(task as Record<string, unknown>, ['dueDate', 'due_date']);
          return Boolean(due && normalizeTaskStatus(task.status) !== 'DONE' && due.getTime() < Date.now());
        }).length;
        const previousOverdueTasks = previousTasks.filter((task) => {
          const due = getDateValue(task as Record<string, unknown>, ['dueDate', 'due_date']);
          return Boolean(due && normalizeTaskStatus(task.status) !== 'DONE' && due.getTime() < Date.now());
        }).length;
        const activeMembers = members.filter((membership) => {
          const member = usersById.get(membership.userId);
          return normalizeEmploymentStatus(member?.employmentStatus) !== 'LEFT';
        }).length;
        const leftMembers = Math.max(0, members.length - activeMembers);
        const healthScore = clamp(100 - overdueTasks * 8 - leftMembers * 6 + completionRate * 0.4 + activeMembers * 2);
        const previousHealthScore = clamp(100 - previousOverdueTasks * 8 - leftMembers * 6 + previousCompletionRate * 0.4 + activeMembers * 2);

        return {
          workspaceId,
          workspaceName: String(workspace.name ?? ''),
          ownerName: String(usersById.get(String(workspace.ownerId || ''))?.name || 'Workspace owner'),
          projects: projects.length,
          tasks: currentTasks.length,
          openTasks: Math.max(0, currentTasks.length - done),
          completionRate,
          members: members.length,
          activeMembers,
          leftMembers,
          overdueTasks,
          healthScore,
          __previous: {
            tasks: previousTasks.length,
            completionRate: previousCompletionRate,
            overdueTasks: previousOverdueTasks,
            healthScore: previousHealthScore,
          },
        };
      })
    );

    const employeeReportsDetailed = await Promise.all(
      users.map(async (user) => {
        const assignedTasks = await Task.collection.find(buildAssigneeFilter(user)).toArray();
        const currentTasks = windowDays > 0
          ? assignedTasks.filter((task) => inRange(getTaskActivityDate(task as Record<string, unknown>), currentStartMs, currentEndMs))
          : assignedTasks;
        const previousTasks = windowDays > 0
          ? assignedTasks.filter((task) => inRange(getTaskActivityDate(task as Record<string, unknown>), previousStartMs, previousEndMs))
          : assignedTasks;
        const completed = currentTasks.filter((task) => normalizeTaskStatus(task.status) === 'DONE').length;
        const previousCompleted = previousTasks.filter((task) => normalizeTaskStatus(task.status) === 'DONE').length;
        const overdueTasks = currentTasks.filter((task) => {
          const due = getDateValue(task as Record<string, unknown>, ['dueDate', 'due_date']);
          return Boolean(due && normalizeTaskStatus(task.status) !== 'DONE' && due.getTime() < Date.now());
        }).length;
        const previousOverdueTasks = previousTasks.filter((task) => {
          const due = getDateValue(task as Record<string, unknown>, ['dueDate', 'due_date']);
          return Boolean(due && normalizeTaskStatus(task.status) !== 'DONE' && due.getTime() < Date.now());
        }).length;
        const membershipRefs = membershipsByUser.get(String(user._id)) || [];
        const tasksForWorkspaceStats = windowDays > 0 ? currentTasks : assignedTasks;
        const projectIdsFromTasks = Array.from(
          new Set(
            tasksForWorkspaceStats
              .map((task) => String(task.projectId || task.project_id || ''))
              .filter(Boolean)
          )
        );
        const taskProjects = projectIdsFromTasks.length > 0
          ? await Project.find({ _id: { $in: projectIdsFromTasks } })
            .select('_id workspaceId workspace_id')
            .lean<AnyRecord[]>()
          : [];
        const taskWorkspaceNames = taskProjects
          .map((project) => workspaceById.get(String(project.workspaceId || project.workspace_id || ''))?.name)
          .filter((name): name is string => Boolean(name));
        const membershipWorkspaceNames = membershipRefs
          .map((membership) => workspaceById.get(membership.workspaceId)?.name)
          .filter((workspaceName): workspaceName is string => Boolean(workspaceName));
        const workspaceNames = Array.from(new Set(windowDays > 0 ? taskWorkspaceNames : [...membershipWorkspaceNames, ...taskWorkspaceNames]));
        const contractRemainingDays = user.contractExpiry
          ? Math.max(0, Math.ceil((new Date(user.contractExpiry as string | Date).getTime() - Date.now()) / 86400000))
          : null;
        const status = normalizeEmploymentStatus(user.employmentStatus);
        const completionRate = currentTasks.length ? Math.round((completed / currentTasks.length) * 100) : 0;
        const previousCompletionRate = previousTasks.length ? Math.round((previousCompleted / previousTasks.length) * 100) : 0;
        const completionDelta = completionRate - previousCompletionRate;
        const completionTrend7 = buildDailyCountTrend(
          assignedTasks as AnyRecord[],
          (task) => normalizeTaskStatus(String(task.status || '')) === 'DONE',
          false
        );
        const overdueTrend7 = buildDailyCountTrend(
          assignedTasks as AnyRecord[],
          (task) => normalizeTaskStatus(String(task.status || '')) !== 'DONE',
          true
        );
        const healthScore = clamp(
          100 - overdueTasks * 12 + Math.round((completed / Math.max(1, currentTasks.length)) * 40) + (status === 'LEFT' ? -20 : 0) + (user.presenceStatus === 'ONLINE' ? 5 : 0)
        );
        const previousHealthScore = clamp(
          100 - previousOverdueTasks * 12 + Math.round((previousCompleted / Math.max(1, previousTasks.length)) * 40) + (status === 'LEFT' ? -20 : 0) + (user.presenceStatus === 'ONLINE' ? 5 : 0)
        );
        const totalTimeSeconds = currentTasks.reduce((sum, task) => sum + Number(task.timeSpent || 0), 0);
        const totalTrackedHours = Number((totalTimeSeconds / 3600).toFixed(1));
        const averageTimeSpentHours = currentTasks.length
          ? Number((totalTimeSeconds / currentTasks.length / 3600).toFixed(2))
          : 0;
        const throughputPerHour = totalTimeSeconds > 0 ? (completed / (totalTimeSeconds / 3600)) : 0;
        const efficiencyScore = clamp(
          completionRate * 0.55 +
          Math.min(100, throughputPerHour * 35) * 0.25 +
          Math.max(0, 100 - overdueTasks * 22) * 0.2
        );
        const productivityScore = clamp(
          completionRate * 0.45 +
          Math.min(100, completed * 8) * 0.3 +
          Math.max(0, 100 - Math.max(0, currentTasks.length - completed) * 7) * 0.25
        );
        const burnoutRisk = clamp(
          Math.max(0, currentTasks.length - completed) * 10 +
          overdueTasks * 14 +
          (averageTimeSpentHours > 6 ? 12 : 0) +
          (user.presenceStatus === 'OFFLINE' && currentTasks.length > 0 ? 6 : 0) +
          (completionRate < 55 ? 8 : 0)
        );
        const workloadState = burnoutRisk >= 70 ? 'OVERLOADED' : burnoutRisk >= 45 ? 'STRETCHED' : 'BALANCED';

        return {
          userId: String(user._id),
          name: user.name,
          email: user.email,
          designation: user.designation || 'N/A',
          role: normalizePlatformRole(user.role),
          employmentStatus: status,
          contractExpiry: user.contractExpiry || null,
          contractRemainingDays,
          leftAt: user.leftAt || null,
          leftReason: user.leftReason || '',
          totalAssigned: currentTasks.length,
          completed,
          completionRate,
          completionDelta,
          completionTrend7,
          totalTrackedHours,
          averageTimeSpentHours,
          efficiencyScore,
          productivityScore,
          burnoutRisk,
          workloadState,
          overdueTasks,
          openTasks: Math.max(0, currentTasks.length - completed),
          overdueDelta: overdueTasks - previousOverdueTasks,
          overdueTrend7,
          workspaceCount: workspaceNames.length,
          workspaceNames,
          lastSeenAt: user.lastSeenAt || null,
          presenceStatus: user.presenceStatus || 'OFFLINE',
          healthScore,
          __previous: {
            totalAssigned: previousTasks.length,
            completed: previousCompleted,
            completionRate: previousCompletionRate,
            overdueTasks: previousOverdueTasks,
            healthScore: previousHealthScore,
          },
        };
      })
    );

    const workspaceReports = workspaceReportsDetailed.map((workspace) => {
      const clone = { ...workspace } as AnyRecord;
      delete clone.__previous;
      return clone;
    });

    const employeeReports = employeeReportsDetailed.map((person) => {
      const clone = { ...person } as AnyRecord;
      delete clone.__previous;
      return clone;
    });

    const avgCurrentWorkspaceHealth = workspaceReportsDetailed.length
      ? workspaceReportsDetailed.reduce((sum, item) => sum + item.healthScore, 0) / workspaceReportsDetailed.length
      : 0;
    const avgPreviousWorkspaceHealth = workspaceReportsDetailed.length
      ? workspaceReportsDetailed.reduce((sum, item) => sum + item.__previous.healthScore, 0) / workspaceReportsDetailed.length
      : 0;
    const avgCurrentEmployeeHealth = employeeReportsDetailed.length
      ? employeeReportsDetailed.reduce((sum, item) => sum + item.healthScore, 0) / employeeReportsDetailed.length
      : 0;
    const avgPreviousEmployeeHealth = employeeReportsDetailed.length
      ? employeeReportsDetailed.reduce((sum, item) => sum + item.__previous.healthScore, 0) / employeeReportsDetailed.length
      : 0;
    const currentCompletionRate = workspaceReportsDetailed.length
      ? workspaceReportsDetailed.reduce((sum, item) => sum + item.completionRate, 0) / workspaceReportsDetailed.length
      : 0;
    const previousCompletionRate = workspaceReportsDetailed.length
      ? workspaceReportsDetailed.reduce((sum, item) => sum + item.__previous.completionRate, 0) / workspaceReportsDetailed.length
      : 0;
    const currentOverdue = workspaceReportsDetailed.reduce((sum, item) => sum + item.overdueTasks, 0);
    const previousOverdue = workspaceReportsDetailed.reduce((sum, item) => sum + item.__previous.overdueTasks, 0);
    const currentOpen = workspaceReportsDetailed.reduce((sum, item) => sum + item.openTasks, 0);
    const previousOpen = workspaceReportsDetailed.reduce((sum, item) => sum + Math.max(0, item.__previous.tasks - Math.round((item.__previous.tasks * item.__previous.completionRate) / 100)), 0);

    return NextResponse.json(
      {
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          windowDays,
          summary: {
            current: {
              avgWorkspaceHealth: Math.round(avgCurrentWorkspaceHealth),
              avgEmployeeHealth: Math.round(avgCurrentEmployeeHealth),
              completionRate: Math.round(currentCompletionRate),
              overdueTasks: currentOverdue,
              openTasks: currentOpen,
            },
            previous: {
              avgWorkspaceHealth: Math.round(avgPreviousWorkspaceHealth),
              avgEmployeeHealth: Math.round(avgPreviousEmployeeHealth),
              completionRate: Math.round(previousCompletionRate),
              overdueTasks: previousOverdue,
              openTasks: previousOpen,
            },
            delta: {
              avgWorkspaceHealth: toScoreDelta(avgCurrentWorkspaceHealth, avgPreviousWorkspaceHealth),
              avgEmployeeHealth: toScoreDelta(avgCurrentEmployeeHealth, avgPreviousEmployeeHealth),
              completionRate: toScoreDelta(currentCompletionRate, previousCompletionRate),
              overdueTasks: currentOverdue - previousOverdue,
              openTasks: currentOpen - previousOpen,
            },
          },
          workspaceReports,
          employeeReports,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

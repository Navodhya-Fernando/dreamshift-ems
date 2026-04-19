import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import { getAccessibleWorkspaceIds } from '@/lib/tenancy';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'IN_REVIEW';

function buildProjectFilter(workspaceIds: string[], workspaceObjectIds: mongoose.Types.ObjectId[]) {
  return {
    $or: [
      { workspaceId: { $in: workspaceObjectIds } },
      { workspaceId: { $in: workspaceIds } },
      { workspace_id: { $in: workspaceObjectIds } },
      { workspace_id: { $in: workspaceIds } },
    ],
  };
}

function buildTaskFilter(projectIds: Array<string | { toString(): string }>) {
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

function normalizeStatus(status?: string): TaskStatus {
  const upper = String(status || 'TODO').toUpperCase().replace(/\s+/g, '_');
  if (upper === 'COMPLETED') return 'DONE';
  if (upper === 'TO_DO') return 'TODO';
  if (upper === 'INPROGRESS') return 'IN_PROGRESS';
  if (upper === 'IN_REVIEW') return 'IN_REVIEW';
  if (upper === 'BLOCKED') return 'BLOCKED';
  if (upper === 'DONE') return 'DONE';
  return 'TODO';
}

function getTaskDate(task: Record<string, unknown>, keys: string[]): Date | null {
  for (const key of keys) {
    const value = task[key];
    if (!value) continue;
    const date = new Date(value as Date | string);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const workspaceIds = await getAccessibleWorkspaceIds(userId);
    const workspaceObjectIds = workspaceIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const projects = await Project.collection
      .find(buildProjectFilter(workspaceIds, workspaceObjectIds), { projection: { _id: 1, name: 1 } })
      .toArray();
    const projectIds = projects.map((project) => project._id);
    const projectNameById = new Map(projects.map((project) => [String(project._id), String(project.name || 'Project')]));
    
    const tasks = await Task.collection.find(buildTaskFilter(projectIds)).toArray();

    const completed = tasks.filter((task) => normalizeStatus(String(task.status || 'TODO')) === 'DONE').length;
    const inProgress = tasks.filter((task) => normalizeStatus(String(task.status || 'TODO')) === 'IN_PROGRESS').length;
    const todo = tasks.filter((task) => normalizeStatus(String(task.status || 'TODO')) === 'TODO').length;
    const blocked = tasks.filter((task) => normalizeStatus(String(task.status || 'TODO')) === 'BLOCKED').length;
    const inReview = tasks.filter((task) => normalizeStatus(String(task.status || 'TODO')) === 'IN_REVIEW').length;
    const total = tasks.length;

    const now = new Date();
    const doneEventsByDay = new Map<string, number>();

    for (let offset = 13; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setUTCHours(0, 0, 0, 0);
      day.setUTCDate(day.getUTCDate() - offset);
      doneEventsByDay.set(dayKey(day), 0);
    }

    tasks.forEach((task) => {
      if (normalizeStatus(String(task.status || 'TODO')) !== 'DONE') return;
      const completionDate = getTaskDate(task as Record<string, unknown>, ['endDate', 'end_date', 'updatedAt', 'createdAt', 'created_at']);
      if (!completionDate) return;
      const key = dayKey(completionDate);
      if (doneEventsByDay.has(key)) {
        doneEventsByDay.set(key, (doneEventsByDay.get(key) || 0) + 1);
      }
    });

    const velocity14 = Array.from(doneEventsByDay.values());
    const velocity = velocity14.slice(-7);
    const last7Done = velocity.reduce((sum, value) => sum + value, 0);
    const prev7Done = velocity14.slice(0, 7).reduce((sum, value) => sum + value, 0);
    const velocityDeltaPct = prev7Done === 0 ? (last7Done > 0 ? 100 : 0) : Math.round(((last7Done - prev7Done) / prev7Done) * 100);

    const dueTasks = tasks.filter((task) => getTaskDate(task as Record<string, unknown>, ['dueDate', 'due_date']));
    const openTasks = tasks.filter((task) => normalizeStatus(String(task.status || 'TODO')) !== 'DONE');
    const overdue = openTasks.filter((task) => {
      const due = getTaskDate(task as Record<string, unknown>, ['dueDate', 'due_date']);
      return Boolean(due && due.getTime() < now.getTime());
    }).length;
    const dueNext7 = openTasks.filter((task) => {
      const due = getTaskDate(task as Record<string, unknown>, ['dueDate', 'due_date']);
      return Boolean(due && due.getTime() >= now.getTime() && due.getTime() <= now.getTime() + 7 * 86400000);
    }).length;
    const dueNext30 = openTasks.filter((task) => {
      const due = getTaskDate(task as Record<string, unknown>, ['dueDate', 'due_date']);
      return Boolean(due && due.getTime() >= now.getTime() && due.getTime() <= now.getTime() + 30 * 86400000);
    }).length;

    const doneWithDue = tasks.filter((task) => {
      const status = normalizeStatus(String(task.status || 'TODO'));
      return status === 'DONE' && Boolean(getTaskDate(task as Record<string, unknown>, ['dueDate', 'due_date']));
    });
    const onTimeDone = doneWithDue.filter((task) => {
      const due = getTaskDate(task as Record<string, unknown>, ['dueDate', 'due_date']);
      const finished = getTaskDate(task as Record<string, unknown>, ['endDate', 'end_date', 'updatedAt']);
      return Boolean(due && finished && finished.getTime() <= due.getTime());
    }).length;
    const onTimeRate = doneWithDue.length ? Math.round((onTimeDone / doneWithDue.length) * 100) : 0;

    const byProject = new Map<string, Array<Record<string, unknown>>>();
    tasks.forEach((task) => {
      const pid = String(task.projectId || task.project_id || '');
      if (!pid) return;
      if (!byProject.has(pid)) byProject.set(pid, []);
      byProject.get(pid)?.push(task as Record<string, unknown>);
    });

    const projectRisks = Array.from(byProject.entries())
      .map(([projectId, projectTasks]) => {
        const doneCount = projectTasks.filter((task) => normalizeStatus(String(task.status || 'TODO')) === 'DONE').length;
        const openCount = projectTasks.length - doneCount;
        const blockedCount = projectTasks.filter((task) => normalizeStatus(String(task.status || 'TODO')) === 'BLOCKED').length;
        const overdueCount = projectTasks.filter((task) => {
          const due = getTaskDate(task, ['dueDate', 'due_date']);
          const status = normalizeStatus(String(task.status || 'TODO'));
          return Boolean(due && status !== 'DONE' && due.getTime() < now.getTime());
        }).length;
        const completionRate = projectTasks.length ? Math.round((doneCount / projectTasks.length) * 100) : 0;
        const riskScore = clamp(Math.round(overdueCount * 18 + blockedCount * 12 + (100 - completionRate) * 0.5), 0, 100);

        return {
          projectId,
          projectName: projectNameById.get(projectId) || 'Project',
          total: projectTasks.length,
          open: openCount,
          overdue: overdueCount,
          blocked: blockedCount,
          completionRate,
          riskScore,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 8);

    return NextResponse.json({ 
      success: true, 
      data: {
        distribution: [completed, inProgress, todo],
        total,
        completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
        velocity,
        velocity14,
        statusBreakdown: {
          done: completed,
          inProgress,
          todo,
          blocked,
          inReview,
        },
        flow: {
          last7Done,
          prev7Done,
          velocityDeltaPct,
        },
        delivery: {
          overdue,
          dueNext7,
          dueNext30,
          onTimeRate,
          withDueDates: dueTasks.length,
        },
        projectRisks,
      }
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

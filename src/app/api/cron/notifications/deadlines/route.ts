import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import User from '@/models/User';
import { notifyUserOnce } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

function normalizeTaskStatus(status: unknown) {
  const normalized = String(status || 'TODO').trim().toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'COMPLETED') return 'DONE';
  if (normalized === 'TO_DO') return 'TODO';
  if (normalized === 'INPROGRESS') return 'IN_PROGRESS';
  return normalized;
}

function getTaskDueDate(task: Record<string, unknown>) {
  const raw = task.dueDate || task.due_date;
  if (!raw) return null;
  const dueDate = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(dueDate.getTime()) ? null : dueDate;
}

function getTaskAssigneeId(task: Record<string, unknown>, userByEmail: Map<string, string>) {
  const assigneeId = String(task.assigneeId || '').trim();
  if (assigneeId && mongoose.isValidObjectId(assigneeId)) return assigneeId;

  const assigneeEmail = String(task.assignee || '').trim().toLowerCase();
  if (assigneeEmail && userByEmail.has(assigneeEmail)) {
    return String(userByEmail.get(assigneeEmail));
  }

  return '';
}

function toUtcDateStamp(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeProjectStatus(status: unknown) {
  return String(status || 'ACTIVE').trim().toUpperCase();
}

function getProjectDeadline(project: Record<string, unknown>) {
  const raw = project.deadline || project.endDate || project.end_date;
  if (!raw) return null;
  const deadline = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(deadline.getTime()) ? null : deadline;
}

function getProjectOwnerId(project: Record<string, unknown>) {
  const owner = String(project.ownerId || project.owner_id || '').trim();
  if (!owner || !mongoose.isValidObjectId(owner)) return '';
  return owner;
}

export async function GET(req: Request) {
  try {
    const expectedSecret = String(process.env.CRON_SECRET || '').trim();
    if (!expectedSecret) {
      return NextResponse.json({ success: false, error: 'CRON_SECRET is not configured' }, { status: 500 });
    }

    const authorization = String(req.headers.get('authorization') || '');
    const providedSecret = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : String(req.headers.get('x-cron-secret') || '').trim();

    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized cron request' }, { status: 401 });
    }

    await dbConnect();

    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tasks = await Task.collection
      .find(
        {
          $and: [
            {
              $or: [
                { dueDate: { $exists: true, $ne: null, $lte: horizon } },
                { due_date: { $exists: true, $ne: null, $lte: horizon } },
              ],
            },
            {
              $or: [{ assigneeId: { $exists: true, $ne: null } }, { assignee: { $exists: true, $ne: '' } }],
            },
          ],
        },
        {
          projection: {
            _id: 1,
            title: 1,
            status: 1,
            dueDate: 1,
            due_date: 1,
            assigneeId: 1,
            assignee: 1,
          },
        }
      )
      .toArray();

    const assigneeEmails = Array.from(
      new Set(
        tasks
          .map((task) => String(task.assignee || '').trim().toLowerCase())
          .filter((email) => Boolean(email))
      )
    );

    const usersByEmail = new Map<string, string>();
    if (assigneeEmails.length > 0) {
      const users = await User.find({ email: { $in: assigneeEmails } }, { _id: 1, email: 1 }).lean();
      users.forEach((user) => {
        const email = String(user.email || '').trim().toLowerCase();
        if (email) usersByEmail.set(email, String(user._id));
      });
    }

    let dueSoonAlerts = 0;
    let overdueAlerts = 0;
    let skipped = 0;

    for (const task of tasks) {
      const dueDate = getTaskDueDate(task);
      if (!dueDate) {
        skipped += 1;
        continue;
      }

      const normalizedStatus = normalizeTaskStatus(task.status);
      if (normalizedStatus === 'DONE') {
        skipped += 1;
        continue;
      }

      const assigneeId = getTaskAssigneeId(task, usersByEmail);
      if (!assigneeId) {
        skipped += 1;
        continue;
      }

      const taskId = String(task._id);
      const taskTitle = String(task.title || 'Untitled task');
      const link = `/tasks/${taskId}`;

      if (dueDate.getTime() < now.getTime()) {
        const overdueDayKey = `task.deadline.overdue:${taskId}:${toUtcDateStamp(now)}`;
        const sent = await notifyUserOnce({
          userId: assigneeId,
          type: 'deadline',
          title: 'Task is overdue',
          message: `"${taskTitle}" is overdue. Please review and update it.`,
          link,
          metadata: {
            taskId,
            event: 'task.deadline.overdue',
            dueDate: dueDate.toISOString(),
          },
          dedupeKey: overdueDayKey,
          dedupeWindowHours: 25,
          emailSubject: `Overdue task: ${taskTitle}`,
        });
        if (sent) overdueAlerts += 1;
        continue;
      }

      const dueSoonKey = `task.deadline.soon:${taskId}:${dueDate.toISOString()}`;
      const sent = await notifyUserOnce({
        userId: assigneeId,
        type: 'deadline',
        title: 'Task due in less than 24 hours',
        message: `"${taskTitle}" is due within 24 hours.`,
        link,
        metadata: {
          taskId,
          event: 'task.deadline.soon',
          dueDate: dueDate.toISOString(),
        },
        dedupeKey: dueSoonKey,
        dedupeWindowHours: 72,
        emailSubject: `Deadline reminder: ${taskTitle}`,
      });
      if (sent) dueSoonAlerts += 1;
    }

    const projects = await Project.collection
      .find(
        {
          $and: [
            {
              $or: [
                { deadline: { $exists: true, $ne: null, $lte: horizon } },
                { endDate: { $exists: true, $ne: null, $lte: horizon } },
                { end_date: { $exists: true, $ne: null, $lte: horizon } },
              ],
            },
            {
              $or: [{ ownerId: { $exists: true, $ne: null } }, { owner_id: { $exists: true, $ne: null } }],
            },
          ],
        },
        {
          projection: {
            _id: 1,
            name: 1,
            status: 1,
            deadline: 1,
            endDate: 1,
            end_date: 1,
            ownerId: 1,
            owner_id: 1,
          },
        }
      )
      .toArray();

    let projectDueSoonAlerts = 0;
    let projectOverdueAlerts = 0;
    let skippedProjects = 0;

    for (const project of projects) {
      const projectStatus = normalizeProjectStatus(project.status);
      if (projectStatus === 'CLOSED') {
        skippedProjects += 1;
        continue;
      }

      const ownerId = getProjectOwnerId(project);
      if (!ownerId) {
        skippedProjects += 1;
        continue;
      }

      const deadline = getProjectDeadline(project);
      if (!deadline) {
        skippedProjects += 1;
        continue;
      }

      const projectId = String(project._id);
      const projectName = String(project.name || 'Untitled project');
      const link = `/projects/${projectId}`;

      if (deadline.getTime() < now.getTime()) {
        const overdueDayKey = `project.deadline.overdue:${projectId}:${toUtcDateStamp(now)}`;
        const sent = await notifyUserOnce({
          userId: ownerId,
          type: 'deadline',
          title: 'Project is overdue',
          message: `"${projectName}" is overdue. Review timeline and close/open tasks accordingly.`,
          link,
          metadata: {
            projectId,
            event: 'project.deadline.overdue',
            deadline: deadline.toISOString(),
          },
          dedupeKey: overdueDayKey,
          dedupeWindowHours: 25,
          emailSubject: `Overdue project: ${projectName}`,
        });
        if (sent) projectOverdueAlerts += 1;
        continue;
      }

      const dueSoonKey = `project.deadline.soon:${projectId}:${deadline.toISOString()}`;
      const sent = await notifyUserOnce({
        userId: ownerId,
        type: 'deadline',
        title: 'Project due in less than 24 hours',
        message: `"${projectName}" is due within 24 hours.`,
        link,
        metadata: {
          projectId,
          event: 'project.deadline.soon',
          deadline: deadline.toISOString(),
        },
        dedupeKey: dueSoonKey,
        dedupeWindowHours: 72,
        emailSubject: `Project deadline reminder: ${projectName}`,
      });
      if (sent) projectDueSoonAlerts += 1;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          scanned: {
            tasks: tasks.length,
            projects: projects.length,
          },
          dueSoonAlerts,
          overdueAlerts,
          skipped,
          projectDueSoonAlerts,
          projectOverdueAlerts,
          skippedProjects,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

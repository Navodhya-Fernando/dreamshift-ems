import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import User from '@/models/User';
import { notifyUserOnce } from '@/lib/notifications';
import { sendBrevoEmail } from '@/lib/brevo';
import { buildDailyTaskSummaryEmail, getDailySummaryLocalDateKey, resolveDailySummarySendAt } from '@/lib/taskSummary';

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

function buildAssigneeMatchers(userId: string, email?: string, name?: string) {
  const matchers: Array<Record<string, unknown>> = [
    { assigneeId: userId },
    { assigneeId: mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId },
  ];

  if (email) {
    matchers.push({ assignee: email });
    matchers.push({ assignee: email.toLowerCase() });
  }

  if (name) {
    matchers.push({ assignee: name });
  }

  return matchers;
}

function normalizeDigestTaskStatus(status: unknown) {
  const normalized = String(status || 'TODO').trim().toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'COMPLETED') return 'DONE';
  if (normalized === 'TO_DO') return 'TODO';
  if (normalized === 'INPROGRESS') return 'IN_PROGRESS';
  return normalized;
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

    const summaryUsers = await User.find(
      { email: { $exists: true, $ne: '' } },
      {
        _id: 1,
        name: 1,
        email: 1,
        notificationPreferences: 1,
        dailySummaryLastScheduledFor: 1,
      }
    ).lean();

    let dailySummaryScheduled = 0;
    let dailySummarySkipped = 0;

    for (const user of summaryUsers) {
      const preferences = user.notificationPreferences || {};
      if (preferences.emailNotifications === false) {
        dailySummarySkipped += 1;
        continue;
      }

      const preferredTime = String(preferences.dailySummaryTime || '07:45');
      const timeZone = String(preferences.dailySummaryTimezone || 'Asia/Kolkata') || 'Asia/Kolkata';
      const scheduledAt = resolveDailySummarySendAt(timeZone, preferredTime, now);
      const targetDayKey = getDailySummaryLocalDateKey(scheduledAt, timeZone);

      if (String(user.dailySummaryLastScheduledFor || '') === targetDayKey) {
        dailySummarySkipped += 1;
        continue;
      }

      const assigneeMatchers = buildAssigneeMatchers(String(user._id), String(user.email || ''), String(user.name || ''));
      const assignedTasks = await Task.collection
        .find(
          {
            $and: [{ $or: assigneeMatchers }],
          },
          {
            projection: {
              _id: 1,
              title: 1,
              description: 1,
              dueDate: 1,
              due_date: 1,
              status: 1,
              priority: 1,
              projectId: 1,
              project_id: 1,
              createdAt: 1,
              created_at: 1,
              updatedAt: 1,
              updated_at: 1,
            },
          }
        )
        .sort({ dueDate: 1, due_date: 1, createdAt: 1, created_at: 1 })
        .toArray();

      const openTasks = assignedTasks
        .filter((task) => normalizeDigestTaskStatus(task.status) !== 'DONE')
        .map((task) => ({
          title: String(task.title || 'Untitled task'),
          dueDate: task.dueDate || task.due_date || null,
          status: String(task.status || 'TODO'),
          priority: String(task.priority || 'MEDIUM'),
          projectName: String(task.projectId || task.project_id || ''),
        }));

      if (openTasks.length === 0) {
        dailySummarySkipped += 1;
        continue;
      }

      const projectIds = openTasks.map((task) => String(task.projectName || '')).filter(Boolean);
      const projectObjectIds = projectIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
      const projectsForUser = projectObjectIds.length > 0
        ? await Project.collection
            .find(
              {
                _id: { $in: projectObjectIds },
              },
              { projection: { _id: 1, name: 1 } }
            )
            .toArray()
        : [];

      const projectNameById = new Map(projectsForUser.map((project) => [String(project._id), String(project.name || 'Project')]));
      const dashboardUrl = `${String(process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '') || 'http://localhost:3000'}/tasks`;
      const summaryEmail = buildDailyTaskSummaryEmail({
        userName: String(user.name || 'there'),
        tasks: openTasks.map((task) => ({
          ...task,
          projectName: projectNameById.get(task.projectName) || 'Project',
        })),
        openTaskCount: openTasks.length,
        dashboardUrl,
      });

      const scheduled = await sendBrevoEmail({
        toEmail: String(user.email || ''),
        toName: String(user.name || ''),
        subject: summaryEmail.subject,
        htmlContent: summaryEmail.htmlContent,
        textContent: summaryEmail.textContent,
        scheduledAt: scheduledAt.toISOString(),
      });

      if (!scheduled) {
        dailySummarySkipped += 1;
        continue;
      }

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            dailySummaryLastScheduledFor: targetDayKey,
          },
        }
      );

      dailySummaryScheduled += 1;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          scanned: {
            tasks: tasks.length,
            projects: projects.length,
          },
          overdueAlerts,
          skipped,
          projectDueSoonAlerts,
          projectOverdueAlerts,
          skippedProjects,
          dailySummaryScheduled,
          dailySummarySkipped,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

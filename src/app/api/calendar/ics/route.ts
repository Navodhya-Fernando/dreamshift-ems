import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import User from '@/models/User';
import { getAccessibleWorkspaceIds } from '@/lib/tenancy';

function getAnchorDate(task: Record<string, unknown>) {
  const raw = task.dueDate || task.due_date || task.createdAt || task.created_at || task.updatedAt || task.updated_at;
  const date = raw ? new Date(String(raw)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toUtcStamp(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function toDateStamp(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function escapeIcsValue(value: string) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const userEmail = String((session.user as { email?: string }).email || '');

    const workspaceIds = await getAccessibleWorkspaceIds(userId);
    const workspaceObjectIds = workspaceIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const users = await User.find({}, { _id: 1, name: 1, email: 1 }).lean();
    const currentUser = users.find((user) => String(user._id) === String(userId));

    const projects = await Project.collection
      .find(buildProjectFilter(workspaceIds, workspaceObjectIds), { projection: { _id: 1, name: 1 } })
      .toArray();

    const projectIds = projects.map((project) => project._id);
    const projectIdStrings = projectIds.map(String);
    const projectNameById = new Map(projects.map((project) => [String(project._id), String(project.name || 'General')]));

    const assigneeMatchers: Array<Record<string, unknown>> = [
      { assigneeId: userId },
      { assigneeId: mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId },
    ];
    if (userEmail) {
      assigneeMatchers.push({ assignee: userEmail });
      assigneeMatchers.push({ assignee: userEmail.toLowerCase() });
    }
    if (currentUser?.name) {
      assigneeMatchers.push({ assignee: currentUser.name });
    }

    const tasks = await Task.collection.find({
      $and: [
        {
          $or: [
            { projectId: { $in: projectIds } },
            { projectId: { $in: projectIdStrings } },
            { project_id: { $in: projectIds } },
            { project_id: { $in: projectIdStrings } },
          ],
        },
        { $or: assigneeMatchers },
      ],
    }).toArray();

    const nowStamp = toUtcStamp(new Date());

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DreamShift EMS//Assigned Tasks Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    tasks.forEach((task) => {
      const due = getAnchorDate(task);

      const summary = escapeIcsValue(String(task.title || 'Task'));
      const projectName = projectNameById.get(String(task.projectId || task.project_id)) || 'General';
      const description = escapeIcsValue(
        [
          `Project: ${projectName}`,
          `Status: ${String(task.status || 'TODO')}`,
          `Priority: ${String(task.priority || 'MEDIUM')}`,
          task.dueDate || task.due_date ? '' : 'Deadline: No deadline set',
          task.description ? `Description: ${String(task.description)}` : '',
        ].filter(Boolean).join('\n')
      );

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:task-${String(task._id)}@dreamshift-ems`);
      lines.push(`DTSTAMP:${nowStamp}`);
      lines.push(`DTSTART;VALUE=DATE:${toDateStamp(due)}`);
      lines.push(`DTEND;VALUE=DATE:${toDateStamp(new Date(due.getTime() + 24 * 60 * 60 * 1000))}`);
      lines.push(`SUMMARY:${summary}`);
      lines.push(`DESCRIPTION:${description}`);
      lines.push('STATUS:CONFIRMED');
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');

    return new NextResponse(lines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="dreamshift-assigned-tasks.ics"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

import { monitored } from '@/lib/routeTelemetry';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import User from '@/models/User';
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

function buildProjectFilter(projectIds: Array<string | { toString(): string }>) {
  const stringIds = projectIds.map((value) => String(value));
  return {
    $or: [
      { _id: { $in: projectIds.map(id => mongoose.isValidObjectId(String(id)) ? new mongoose.Types.ObjectId(String(id)) : id) } },
      { _id: { $in: stringIds } },
    ],
  };
}

async function handleGET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    await dbConnect();

    const user = await User.findById(userId, { name: 1, email: 1 }).lean();

    const assignedTasks = await Task.collection
      .find(buildAssigneeFilter({ _id: userId, email: user?.email ?? undefined, name: user?.name ?? undefined }), { projection: { title: 1, status: 1, dueDate: 1, due_date: 1, projectId: 1, project_id: 1, timeSpent: 1, updatedAt: 1, created_at: 1 } })
      .sort({ updatedAt: -1, created_at: -1 })
      .toArray();
    const projectIds = [...new Set(assignedTasks.map((task) => String(task.projectId || task.project_id || '')).filter(Boolean))];
    const projects = projectIds.length ? await Project.collection.find(buildProjectFilter(projectIds) as never, { projection: { _id: 1, name: 1 } }).toArray() : [];
    const projectNameById = new Map(projects.map((project) => [String(project._id), String(project.name || 'General')]));

    const isDone = (status: unknown) => ['DONE','COMPLETED'].includes(String(status || '').toUpperCase());
    const now = Date.now();
    let done = 0, overdue = 0, totalSeconds = 0;
    const openTasks = assignedTasks.filter(task => {
      totalSeconds += Number(task.timeSpent || 0);
      if (isDone(task.status)) { done++; return false; }
      const due = task.dueDate || task.due_date;
      if (due && new Date(due).getTime() < now) overdue++;
      return true;
    });
    const active = openTasks.length;
    const completion = assignedTasks.length ? Math.round((done / assignedTasks.length) * 100) : 0;
    const hours = `${(totalSeconds / 3600).toFixed(1)}h`;

    const upcoming = openTasks
      .filter((task) => (task.dueDate || task.due_date))
      .sort((a, b) => new Date((a.dueDate || a.due_date) as Date).getTime() - new Date((b.dueDate || b.due_date) as Date).getTime())
      .slice(0, 4)
      .map((task) => ({
        id: task._id,
        title: task.title,
        dueDate: task.dueDate || task.due_date,
        status: task.status,
        projectName: projectNameById.get(String(task.projectId || task.project_id)) || 'General',
      }));

    const recentTaskActivity = assignedTasks.slice(0, 5).map((task) => ({
      id: `task-${task._id}`,
      msg: `Task \"${task.title}\" is ${String(task.status || 'TODO').replace('_', ' ').toLowerCase()}`,
      time: new Date(task.updatedAt).toLocaleString(),
      color: task.status === 'DONE' ? '#10B981' : task.status === 'BLOCKED' ? '#EF4444' : '#5B6BF8',
    }));

    const comments = await Comment.find({ userId })
      .populate('taskId', 'title')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    const commentActivity = comments.map((comment) => ({
      id: `comment-${comment._id}`,
      msg: `Commented on \"${(comment.taskId as { title?: string })?.title || 'task'}\"`,
      time: new Date(comment.createdAt).toLocaleString(),
      color: '#F59E0B',
    }));

    const activity = [...recentTaskActivity, ...commentActivity]
      .sort((a, b) => (new Date(b.time).getTime() || 0) - (new Date(a.time).getTime() || 0))
      .slice(0, 6);

    const completionProbability = Math.max(5, Math.min(99, Math.round(completion - overdue * 4 + 10)));
    const burnoutRiskScore = Math.min(100, Math.round((active * 12) + (overdue * 15)));
    const burnoutRiskLabel = burnoutRiskScore < 35 ? 'Low' : burnoutRiskScore < 70 ? 'Medium' : 'High';

    return NextResponse.json(
      {
        success: true,
        data: {
          kpi: { active, completion, hours, overdue },
          myTasks: openTasks.slice(0, 6).map((task) => ({
            _id: task._id,
            title: task.title,
            dueDate: task.dueDate || task.due_date,
            status: String(task.status || 'TODO').toLowerCase(),
            projectId: task.projectId || task.project_id,
            projectName: projectNameById.get(String(task.projectId || task.project_id)) || 'General',
          })),
          upcoming,
          activity,
          insights: {
            completionProbability,
            burnoutRiskScore,
            burnoutRiskLabel,
          },
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export const GET=monitored('dashboard.get',handleGET);

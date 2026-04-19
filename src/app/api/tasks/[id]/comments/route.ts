import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Comment from '@/models/Comment';
import Task from '@/models/Task';
import Project from '@/models/Project';
import User from '@/models/User';
import { hasWorkspaceAccess } from '@/lib/tenancy';
import { notifyUser } from '@/lib/notifications';

type DiscussionUser = {
  _id: string;
  name?: string;
  email?: string;
  image?: string;
};

type RawComment = Record<string, unknown>;

function extractMentionHandles(content: string): string[] {
  const matches = content.match(/(^|\s)@([a-zA-Z0-9._-]+)/g) || [];
  const handles = matches.map((item) => item.trim().replace(/^@/, '').replace(/^\s*@/, '').toLowerCase());
  return [...new Set(handles.filter(Boolean))];
}

function normalizeReactionSummary(reactions: Array<{ emoji?: string; userId?: unknown }> = [], currentUserId: string) {
  const summary = new Map<string, { emoji: string; count: number; reacted: boolean }>();
  for (const reaction of reactions) {
    const emoji = String(reaction.emoji || '').trim();
    if (!emoji) continue;
    const existing = summary.get(emoji) || { emoji, count: 0, reacted: false };
    existing.count += 1;
    if (String(reaction.userId || '') === currentUserId) existing.reacted = true;
    summary.set(emoji, existing);
  }
  return [...summary.values()].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

function toDateValue(value: unknown): string {
  if (!value) return new Date(0).toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function buildThread(comments: RawComment[]) {
  const byId = new Map<string, RawComment & { replies: Array<RawComment> }>();
  const roots: Array<RawComment & { replies: Array<RawComment> }> = [];

  for (const comment of comments) {
    byId.set(String(comment._id), { ...comment, replies: [] });
  }

  const sorted = comments.slice().sort((a, b) => toDateValue(a.createdAt || a.created_at).localeCompare(toDateValue(b.createdAt || b.created_at)));

  for (const item of sorted) {
    const node = byId.get(String(item._id));
    if (!node) continue;

    const parentId = item.parentCommentId ? String(item.parentCommentId) : item.parent_comment_id ? String(item.parent_comment_id) : '';
    const parent = parentId ? byId.get(parentId) : null;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  return roots;
}

async function resolveTaskContext(taskId: string, currentUserId: string) {
  if (!mongoose.isValidObjectId(taskId)) return { error: 'Invalid task id', status: 400 } as const;

  const taskObjectId = new mongoose.Types.ObjectId(taskId);
  const task = await Task.collection.findOne({ _id: taskObjectId });
  if (!task) return { error: 'Task not found', status: 404 } as const;

  const projectId = String(task.projectId || task.project_id || '');
  if (!projectId) return { error: 'Project not found', status: 404 } as const;
  if (!mongoose.isValidObjectId(projectId)) return { error: 'Invalid project id', status: 400 } as const;

  const project = await Project.collection.findOne(
    {
      _id: new mongoose.Types.ObjectId(projectId),
    },
    { projection: { workspaceId: 1, workspace_id: 1 } }
  );
  if (!project) return { error: 'Project not found', status: 404 } as const;

  const workspaceId = String(project.workspaceId || project.workspace_id || '');
  const allowed = await hasWorkspaceAccess(currentUserId, workspaceId);
  if (!allowed) return { error: 'Forbidden task access', status: 403 } as const;

  return {
    task,
    projectId,
    workspaceId,
    taskObjectId,
  } as const;
}

async function loadWorkspaceUsers(_workspaceId: string, currentUserId: string) {
  const users = await User.find({}, { _id: 1, name: 1, email: 1, image: 1 }).lean<DiscussionUser[]>();
  const hasCurrent = users.some((user) => String(user._id) === String(currentUserId));
  if (!hasCurrent && mongoose.isValidObjectId(currentUserId)) {
    const me = await User.findById(currentUserId, { _id: 1, name: 1, email: 1, image: 1 }).lean<DiscussionUser | null>();
    if (me) return [me, ...users];
  }
  return users;
}

function matchMentionUsers(handles: string[], users: DiscussionUser[]) {
  if (!handles.length) return [] as DiscussionUser[];

  const normalizedUsers = users.map((user) => {
    const email = String(user.email || '').toLowerCase();
    const emailHandle = email.includes('@') ? email.split('@')[0] : email;
    const nameHandle = String(user.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');
    return { user, email, emailHandle, nameHandle };
  });

  const picked = new Map<string, DiscussionUser>();
  for (const handle of handles) {
    const h = handle.toLowerCase();
    const match = normalizedUsers.find((entry) => entry.email === h || entry.emailHandle === h || entry.nameHandle === h);
    if (match) picked.set(String(match.user._id), match.user);
  }

  return [...picked.values()];
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id: taskId } = await params;
    await dbConnect();

    const currentUserId = (session.user as { id: string }).id;
    const context = await resolveTaskContext(taskId, currentUserId);
    if ('error' in context) {
      return NextResponse.json({ success: false, error: context.error }, { status: context.status });
    }

    const commentsRaw = await Comment.collection
      .find({
        $or: [
          { entityType: 'task', entityId: taskId },
          { entity_type: 'task', entity_id: taskId },
          { taskId: context.taskObjectId },
          { task_id: taskId },
        ],
      })
      .sort({ createdAt: 1, created_at: 1 })
      .toArray();

    const users = await loadWorkspaceUsers(context.workspaceId, currentUserId);
    const usersById = new Map(users.map((user) => [String(user._id), user]));

    const normalized = commentsRaw.map((comment) => {
      const commentUserId = String(comment.userId || comment.user_id || '');
      const fallbackAuthor = {
        _id: commentUserId || 'legacy',
        name: comment.user_name || 'Unknown user',
        email: comment.user_email || undefined,
        image: undefined as string | undefined,
      };

      const author = usersById.get(commentUserId) || fallbackAuthor;

      const mentionIds = Array.isArray(comment.mentions) ? comment.mentions.map((id: unknown) => String(id)) : [];
      const mentionHandles = Array.isArray(comment.mentionHandles) ? comment.mentionHandles.map(String) : [];
      const mentionUsers = mentionIds
        .map((id: string) => usersById.get(id))
        .filter(Boolean)
        .map((user) => ({ _id: user!._id, name: user!.name, email: user!.email }));

      const reactions = normalizeReactionSummary(Array.isArray(comment.reactions) ? comment.reactions : [], currentUserId);
      const isDeleted = Boolean(comment.deletedAt || comment.deleted_at);

      return {
        _id: String(comment._id),
        parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : comment.parent_comment_id ? String(comment.parent_comment_id) : null,
        content: isDeleted ? '[deleted]' : String(comment.content || comment.text || ''),
        createdAt: comment.createdAt || comment.created_at || new Date().toISOString(),
        updatedAt: comment.updatedAt || comment.updated_at || comment.createdAt || comment.created_at || new Date().toISOString(),
        editedAt: comment.editedAt || comment.edited_at || null,
        deletedAt: comment.deletedAt || comment.deleted_at || null,
        mentions: mentionUsers,
        mentionHandles,
        reactions,
        author: {
          _id: String(author._id),
          name: author.name || author.email || 'Unknown user',
          email: author.email,
          image: author.image,
        },
        canEdit: !isDeleted && commentUserId === currentUserId,
        canDelete: !isDeleted && commentUserId === currentUserId,
      };
    });

    return NextResponse.json({ success: true, data: { threads: buildThread(normalized) } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id: taskId } = await params;
    await dbConnect();

    const currentUserId = (session.user as { id: string }).id;
    const context = await resolveTaskContext(taskId, currentUserId);
    if ('error' in context) {
      return NextResponse.json({ success: false, error: context.error }, { status: context.status });
    }

    const body = await req.json();
    const content = String(body.content || '').trim();
    const parentId = body.parentCommentId ? String(body.parentCommentId) : '';

    if (!content) {
      return NextResponse.json({ success: false, error: 'Comment content is required' }, { status: 400 });
    }

    if (parentId) {
      if (!mongoose.isValidObjectId(parentId)) {
        return NextResponse.json({ success: false, error: 'Invalid parent comment id' }, { status: 400 });
      }
      const parent = await Comment.collection.findOne({ _id: new mongoose.Types.ObjectId(parentId) });
      if (!parent) return NextResponse.json({ success: false, error: 'Parent comment not found' }, { status: 404 });
    }

    const users = await loadWorkspaceUsers(context.workspaceId, currentUserId);
    const mentionHandles = extractMentionHandles(content);
    const mentionUsers = matchMentionUsers(mentionHandles, users);

    const created = await Comment.collection.insertOne({
      entityType: 'task',
      entity_type: 'task',
      entityId: taskId,
      entity_id: taskId,
      projectId: mongoose.isValidObjectId(context.projectId) ? new mongoose.Types.ObjectId(context.projectId) : context.projectId,
      project_id: context.projectId,
      taskId: context.taskObjectId,
      task_id: taskId,
      parentCommentId: parentId && mongoose.isValidObjectId(parentId) ? new mongoose.Types.ObjectId(parentId) : undefined,
      parent_comment_id: parentId || undefined,
      userId: new mongoose.Types.ObjectId(currentUserId),
      user_id: currentUserId,
      user_name: (session.user as { name?: string }).name || 'User',
      user_email: (session.user as { email?: string }).email || undefined,
      content,
      text: content,
      mentions: mentionUsers.map((user) => new mongoose.Types.ObjectId(String(user._id))),
      mentionHandles,
      reactions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      created_at: new Date(),
    });

    const actorName = String((session.user as { name?: string }).name || 'A teammate');
    for (const mentionUser of mentionUsers) {
      const mentionId = String(mentionUser._id || '');
      if (!mentionId || mentionId === currentUserId) continue;

      void notifyUser({
        userId: mentionId,
        type: 'mention',
        title: 'You were mentioned in a task comment',
        message: `${actorName} mentioned you: "${content.slice(0, 140)}${content.length > 140 ? '...' : ''}"`,
        link: `/tasks/${taskId}`,
        metadata: {
          taskId,
          commentId: String(created.insertedId),
          actorId: currentUserId,
          event: 'comment.mention',
        },
        emailSubject: `Mentioned in task comment`,
      });
    }

    return NextResponse.json({ success: true, data: { _id: String(created.insertedId) } }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id: taskId } = await params;
    await dbConnect();

    const currentUserId = (session.user as { id: string }).id;
    const context = await resolveTaskContext(taskId, currentUserId);
    if ('error' in context) {
      return NextResponse.json({ success: false, error: context.error }, { status: context.status });
    }

    const body = await req.json();
    const commentId = String(body.commentId || '');
    const action = String(body.action || 'edit');

    if (!mongoose.isValidObjectId(commentId)) {
      return NextResponse.json({ success: false, error: 'Invalid comment id' }, { status: 400 });
    }

    const commentObjectId = new mongoose.Types.ObjectId(commentId);
    const comment = await Comment.collection.findOne({
      _id: commentObjectId,
      $or: [
        { entityType: 'task', entityId: taskId },
        { entity_type: 'task', entity_id: taskId },
        { taskId: context.taskObjectId },
        { task_id: taskId },
      ],
    });
    if (!comment) return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });

    if (action === 'react') {
      const emoji = String(body.emoji || '').trim();
      if (!emoji) return NextResponse.json({ success: false, error: 'Emoji is required' }, { status: 400 });

      const reactions = Array.isArray(comment.reactions) ? comment.reactions : [];
      const currentIdx = reactions.findIndex((reaction: { emoji?: string; userId?: unknown }) => String(reaction.emoji || '') === emoji && String(reaction.userId || '') === currentUserId);

      if (currentIdx >= 0) {
        reactions.splice(currentIdx, 1);
      } else {
        reactions.push({ emoji, userId: new mongoose.Types.ObjectId(currentUserId), createdAt: new Date() });
      }

      await Comment.collection.updateOne({ _id: commentObjectId }, { $set: { reactions, updatedAt: new Date() } });
      return NextResponse.json({ success: true, data: {} }, { status: 200 });
    }

    const ownerId = String(comment.userId || comment.user_id || '');
    if (ownerId !== currentUserId) {
      return NextResponse.json({ success: false, error: 'Only the author can edit this comment' }, { status: 403 });
    }

    const nextContent = String(body.content || '').trim();
    if (!nextContent) {
      return NextResponse.json({ success: false, error: 'Comment content is required' }, { status: 400 });
    }

    const users = await loadWorkspaceUsers(context.workspaceId, currentUserId);
    const mentionHandles = extractMentionHandles(nextContent);
    const mentionUsers = matchMentionUsers(mentionHandles, users);

    await Comment.collection.updateOne(
      { _id: commentObjectId },
      {
        $set: {
          content: nextContent,
          text: nextContent,
          mentions: mentionUsers.map((user) => new mongoose.Types.ObjectId(String(user._id))),
          mentionHandles,
          editedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true, data: {} }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id: taskId } = await params;
    await dbConnect();

    const currentUserId = (session.user as { id: string }).id;
    const context = await resolveTaskContext(taskId, currentUserId);
    if ('error' in context) {
      return NextResponse.json({ success: false, error: context.error }, { status: context.status });
    }

    const body = await req.json().catch(() => ({}));
    const commentId = String(body.commentId || '');
    if (!mongoose.isValidObjectId(commentId)) {
      return NextResponse.json({ success: false, error: 'Invalid comment id' }, { status: 400 });
    }

    const comment = await Comment.collection.findOne({ _id: new mongoose.Types.ObjectId(commentId) });
    if (!comment) return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });

    if (String(comment.userId || comment.user_id || '') !== currentUserId) {
      return NextResponse.json({ success: false, error: 'Only the author can delete this comment' }, { status: 403 });
    }

    await Comment.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(commentId) },
      {
        $set: {
          content: '[deleted]',
          text: '[deleted]',
          deletedAt: new Date(),
          deleted_at: new Date(),
          deletedBy: new mongoose.Types.ObjectId(currentUserId),
          reactions: [],
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true, data: {} }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

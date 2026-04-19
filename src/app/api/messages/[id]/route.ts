import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import { publishMessageEvent } from '@/lib/messageEvents';

async function canAccessMessage(currentUserId: string, message: { senderId: unknown; recipientId: unknown; conversationId?: unknown }) {
  if (String(message.senderId) === String(currentUserId)) return true;
  if (String(message.recipientId) === String(currentUserId)) return true;
  if (!message.conversationId || !mongoose.isValidObjectId(String(message.conversationId))) return false;

  const conversation = await Conversation.findOne({ _id: message.conversationId, participantIds: currentUserId }, { _id: 1 }).lean();
  return Boolean(conversation);
}

async function getMessageTargets(currentUserId: string, message: { senderId: unknown; recipientId: unknown; conversationId?: unknown }) {
  if (message.conversationId && mongoose.isValidObjectId(String(message.conversationId))) {
    const conversation = await Conversation.findById(message.conversationId, { participantIds: 1 }).lean();
    const targets = Array.isArray(conversation?.participantIds)
      ? conversation.participantIds.map((id: unknown) => String(id))
      : [];
    return [...new Set([currentUserId, ...targets])];
  }

  return [...new Set([currentUserId, String(message.senderId), String(message.recipientId)])].filter(Boolean);
}

type MessagePayloadShape = {
  _id: unknown;
  conversationId?: unknown;
  senderId: unknown;
  recipientId: unknown;
  recipientIds?: unknown[];
  content?: unknown;
  status?: unknown;
  readAt?: unknown;
  deliveredAt?: unknown;
  editedAt?: unknown;
  deletedAt?: unknown;
  replyToMessageId?: unknown;
  reactions?: Array<{ emoji: string; userId: mongoose.Types.ObjectId; createdAt?: Date }>;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function toPayload(message: MessagePayloadShape) {
  return {
    _id: String(message._id),
    conversationId: message.conversationId ? String(message.conversationId) : null,
    senderId: String(message.senderId),
    recipientId: String(message.recipientId),
    recipientIds: Array.isArray(message.recipientIds) ? message.recipientIds.map((id) => String(id)) : [],
    content: String(message.content || ''),
    status: message.status || 'SENT',
    readAt: message.readAt || null,
    deliveredAt: message.deliveredAt || null,
    editedAt: message.editedAt || null,
    deletedAt: message.deletedAt || null,
    replyToMessageId: message.replyToMessageId ? String(message.replyToMessageId) : null,
    reactions: Array.isArray(message.reactions)
      ? message.reactions.map((reaction: { emoji: string; userId: mongoose.Types.ObjectId; createdAt?: Date }) => ({
          emoji: reaction.emoji,
          userId: String(reaction.userId),
          createdAt: reaction.createdAt || null,
        }))
      : [],
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id: messageId } = await params;

    if (!mongoose.isValidObjectId(messageId)) {
      return NextResponse.json({ success: false, error: 'Invalid message id' }, { status: 400 });
    }

    await dbConnect();
    const currentUserId = (session.user as { id: string }).id;
    const body = await req.json().catch(() => null);
    const action = typeof body?.action === 'string' ? body.action : '';
    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }

    if (!(await canAccessMessage(currentUserId, message))) {
      return NextResponse.json({ success: false, error: 'Forbidden message access' }, { status: 403 });
    }

    if (action === 'react') {
      const emoji = String(body.emoji || '').trim();
      if (!emoji) {
        return NextResponse.json({ success: false, error: 'emoji is required' }, { status: 400 });
      }

      const reactions = Array.isArray(message.reactions) ? message.reactions : [];
      const existingIndex = reactions.findIndex((reaction: { emoji: string; userId: mongoose.Types.ObjectId }) => String(reaction.userId) === currentUserId && reaction.emoji === emoji);

      if (existingIndex >= 0) {
        reactions.splice(existingIndex, 1);
      } else {
        reactions.push({ emoji, userId: new mongoose.Types.ObjectId(currentUserId), createdAt: new Date() });
      }

      message.reactions = reactions;
      await message.save();
      publishMessageEvent(await getMessageTargets(currentUserId, message), { type: 'message', userId: currentUserId, at: new Date().toISOString(), conversationId: message.conversationId ? String(message.conversationId) : undefined });
      return NextResponse.json({ success: true, data: toPayload(message) }, { status: 200 });
    }

    if (action === 'delete') {
      if (String(message.senderId) !== currentUserId) {
        return NextResponse.json({ success: false, error: 'Only the sender can delete this message' }, { status: 403 });
      }

      message.content = '[deleted]';
      message.deletedAt = new Date();
      message.status = 'READ';
      await message.save();
      publishMessageEvent(await getMessageTargets(currentUserId, message), { type: 'message', userId: currentUserId, at: new Date().toISOString(), conversationId: message.conversationId ? String(message.conversationId) : undefined });
      return NextResponse.json({ success: true, data: toPayload(message) }, { status: 200 });
    }

    if (action === 'edit') {
      if (String(message.senderId) !== currentUserId) {
        return NextResponse.json({ success: false, error: 'Only the sender can edit this message' }, { status: 403 });
      }

      const content = String(body.content || '').trim();
      if (!content) {
        return NextResponse.json({ success: false, error: 'content is required' }, { status: 400 });
      }

      message.content = content;
      message.editedAt = new Date();
      await message.save();
      publishMessageEvent(await getMessageTargets(currentUserId, message), { type: 'message', userId: currentUserId, at: new Date().toISOString(), conversationId: message.conversationId ? String(message.conversationId) : undefined });
      return NextResponse.json({ success: true, data: toPayload(message) }, { status: 200 });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id: messageId } = await params;
    if (!mongoose.isValidObjectId(messageId)) {
      return NextResponse.json({ success: false, error: 'Invalid message id' }, { status: 400 });
    }

    await dbConnect();
    const currentUserId = (session.user as { id: string }).id;
    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }

    if (!(await canAccessMessage(currentUserId, message))) {
      return NextResponse.json({ success: false, error: 'Forbidden message access' }, { status: 403 });
    }

    if (String(message.senderId) !== currentUserId) {
      return NextResponse.json({ success: false, error: 'Only the sender can delete this message' }, { status: 403 });
    }

    message.content = '[deleted]';
    message.deletedAt = new Date();
    message.status = 'READ';
    await message.save();

    publishMessageEvent(await getMessageTargets(currentUserId, message), {
      type: 'message',
      userId: currentUserId,
      at: new Date().toISOString(),
      conversationId: message.conversationId ? String(message.conversationId) : undefined,
    });

    return NextResponse.json({ success: true, data: toPayload(message) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

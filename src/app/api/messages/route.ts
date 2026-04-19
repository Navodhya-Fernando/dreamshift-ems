import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import User from '@/models/User';
import { publishMessageEvent } from '@/lib/messageEvents';
import { checkRateLimit } from '@/lib/rateLimit';

const MAX_MESSAGE_LENGTH = 2000;
const POST_LIMIT_PER_MINUTE = 60;
const POST_WINDOW_MS = 60_000;

async function canMessageUser(currentUserId: string, targetUserId: string) {
  if (String(currentUserId) === String(targetUserId)) return true;
  if (!mongoose.isValidObjectId(targetUserId)) return false;
  const recipient = await User.findById(targetUserId, { _id: 1 }).lean();
  return Boolean(recipient);
}

async function canAccessConversation(currentUserId: string, conversationId: string) {
  if (!mongoose.isValidObjectId(conversationId)) return false;
  const conversation = await Conversation.findOne({ _id: conversationId, participantIds: currentUserId }, { _id: 1 }).lean();
  return Boolean(conversation);
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

function toMessagePayload(message: MessagePayloadShape) {
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

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');
    const limitRaw = Number(searchParams.get('limit') || '30');
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 30;
    const before = searchParams.get('before');
    const markRead = searchParams.get('markRead') === '1';

    await dbConnect();
    const currentUserId = (session.user as { id: string }).id;

    let query: Record<string, unknown>;
    let markReadFilter: Record<string, unknown>;

    if (conversationId) {
      if (!(await canAccessConversation(currentUserId, conversationId))) {
        return NextResponse.json({ success: false, error: 'Forbidden message access' }, { status: 403 });
      }

      query = { conversationId };
      markReadFilter = {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        senderId: { $ne: new mongoose.Types.ObjectId(currentUserId) },
      };
    } else {
      if (!userId) {
        return NextResponse.json({ success: false, error: 'userId or conversationId is required' }, { status: 400 });
      }

      if (!mongoose.isValidObjectId(userId)) {
        return NextResponse.json({ success: false, error: 'Invalid userId' }, { status: 400 });
      }

      if (!(await canMessageUser(currentUserId, userId))) {
        return NextResponse.json({ success: false, error: 'Forbidden message access' }, { status: 403 });
      }

      query = {
        $or: [
          { senderId: currentUserId, recipientId: userId },
          { senderId: userId, recipientId: currentUserId },
        ],
      };
      markReadFilter = {
        senderId: new mongoose.Types.ObjectId(userId),
        recipientId: new mongoose.Types.ObjectId(currentUserId),
      };
    }

    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        query = { ...query, createdAt: { $lt: beforeDate } };
      }
    }

    const rows = await Message.find(query).sort({ createdAt: -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse().map(toMessagePayload);

    if (markRead) {
      const readResult = await Message.updateMany({ ...markReadFilter, readAt: null }, { $set: { readAt: new Date(), status: 'READ' } });
      if ((readResult.modifiedCount || 0) > 0) {
        publishMessageEvent([currentUserId], {
          type: 'read',
          userId: conversationId || userId || currentUserId,
          at: new Date().toISOString(),
          conversationId: conversationId || undefined,
        });
      }
    }

    return NextResponse.json({ success: true, data: messages, hasMore }, { status: 200 });
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
    const currentUserId = (session.user as { id: string }).id;
    const body = await req.json().catch(() => ({}));
    const recipientId = String(body?.recipientId || '');
    const recipientIds = Array.isArray(body?.recipientIds)
      ? body.recipientIds.map((id: unknown) => String(id)).filter(Boolean)
      : [];
    const conversationId = String(body?.conversationId || '');
    const content = String(body?.content || '').trim();
    const replyToMessageId = String(body?.replyToMessageId || '');

    if (!content) {
      return NextResponse.json({ success: false, error: 'content is required' }, { status: 400 });
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ success: false, error: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.` }, { status: 400 });
    }

    const rate = checkRateLimit(`messages:post:${currentUserId}`, POST_LIMIT_PER_MINUTE, POST_WINDOW_MS);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please wait a moment before sending more messages.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
            'X-RateLimit-Limit': String(POST_LIMIT_PER_MINUTE),
            'X-RateLimit-Remaining': String(rate.remaining),
            'X-RateLimit-Reset': String(rate.resetAt),
          },
        }
      );
    }

    let created;
    let publishRecipients: string[] = [];

    if (conversationId) {
      if (!(await canAccessConversation(currentUserId, conversationId))) {
        return NextResponse.json({ success: false, error: 'Forbidden message access' }, { status: 403 });
      }

      const conversation = await Conversation.findById(conversationId, { participantIds: 1 }).lean();
      if (!conversation) {
        return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
      }

      publishRecipients = (conversation.participantIds || [])
        .map((id: unknown) => String(id))
        .filter((id: string) => id !== currentUserId);

      const fallbackRecipientId = publishRecipients[0] || currentUserId;
      created = await Message.create({
        conversationId,
        senderId: currentUserId,
        recipientId: fallbackRecipientId,
        recipientIds: publishRecipients,
        content,
        status: 'SENT',
        readAt: null,
        deliveredAt: new Date(),
        replyToMessageId: replyToMessageId && mongoose.isValidObjectId(replyToMessageId) ? replyToMessageId : null,
      });

      await Conversation.updateOne({ _id: conversationId }, { $set: { lastMessage: content, lastMessageAt: new Date() } });
    } else {
      if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
        return NextResponse.json({ success: false, error: 'Invalid recipientId' }, { status: 400 });
      }

      if (!(await canMessageUser(currentUserId, recipientId))) {
        return NextResponse.json({ success: false, error: 'Forbidden message access' }, { status: 403 });
      }

      publishRecipients = [recipientId];
      created = await Message.create({
        senderId: currentUserId,
        recipientId,
        recipientIds: recipientIds.length ? recipientIds : [recipientId],
        content,
        status: 'SENT',
        readAt: null,
        deliveredAt: new Date(),
        replyToMessageId: replyToMessageId && mongoose.isValidObjectId(replyToMessageId) ? replyToMessageId : null,
      });
    }

    const now = new Date().toISOString();
    publishMessageEvent([currentUserId, ...publishRecipients], {
      type: 'message',
      userId: conversationId ? currentUserId : recipientId,
      at: now,
      conversationId: conversationId || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: toMessagePayload(created),
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Limit': String(POST_LIMIT_PER_MINUTE),
          'X-RateLimit-Remaining': String(rate.remaining),
          'X-RateLimit-Reset': String(rate.resetAt),
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
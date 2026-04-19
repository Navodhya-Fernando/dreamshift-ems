import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Conversation from '@/models/Conversation';
import User from '@/models/User';

function normalizeIdList(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id)).filter(Boolean))];
}

async function canAccessParticipants(currentUserId: string, participantIds: string[]) {
  const allIds = [...new Set([currentUserId, ...participantIds])];
  const users = await User.find({ _id: { $in: allIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id)) } }, { _id: 1 }).lean();
  return users.length === allIds.filter((id) => mongoose.isValidObjectId(id)).length;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const currentUserId = (session.user as { id: string }).id;

    const conversations = await Conversation.find({ participantIds: currentUserId })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json(
      {
        success: true,
        data: conversations.map((conversation) => ({
          id: String(conversation._id),
          name: conversation.name || '',
          isGroup: Boolean(conversation.isGroup),
          participantIds: (conversation.participantIds || []).map((id: unknown) => String(id)),
          createdBy: String(conversation.createdBy),
          lastMessage: conversation.lastMessage || '',
          lastMessageAt: conversation.lastMessageAt || null,
        })),
      },
      { status: 200 }
    );
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
    const body = await req.json();

    const participantIds = normalizeIdList(body.participantIds);
    const name = String(body.name || '').trim();
    const isGroup = Boolean(body.isGroup || participantIds.length > 1);

    if (participantIds.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one participant is required' }, { status: 400 });
    }

    if (!(await canAccessParticipants(currentUserId, participantIds))) {
      return NextResponse.json({ success: false, error: 'Invalid participants' }, { status: 400 });
    }

    const allParticipants = [...new Set([currentUserId, ...participantIds])].map((id) => new mongoose.Types.ObjectId(id));

    if (!isGroup) {
      const existing = await Conversation.findOne({
        isGroup: false,
        participantIds: { $all: allParticipants },
        $expr: { $eq: [{ $size: '$participantIds' }, 2] },
      }).lean();

      if (existing) {
        return NextResponse.json(
          {
            success: true,
            data: {
              id: String(existing._id),
              name: existing.name || '',
              isGroup: false,
              participantIds: (existing.participantIds || []).map((id: unknown) => String(id)),
              createdBy: String(existing.createdBy),
              lastMessage: existing.lastMessage || '',
              lastMessageAt: existing.lastMessageAt || null,
            },
          },
          { status: 200 }
        );
      }
    }

    const conversation = await Conversation.create({
      name: isGroup ? name || 'New group' : '',
      isGroup,
      participantIds: allParticipants,
      createdBy: currentUserId,
      lastMessage: '',
      lastMessageAt: null,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: String(conversation._id),
          name: conversation.name || '',
          isGroup: Boolean(conversation.isGroup),
          participantIds: (conversation.participantIds || []).map((id: unknown) => String(id)),
          createdBy: String(conversation.createdBy),
          lastMessage: conversation.lastMessage || '',
          lastMessageAt: conversation.lastMessageAt || null,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

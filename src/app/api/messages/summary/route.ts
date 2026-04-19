import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const currentUserId = (session.user as { id: string }).id;
    const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);

    const directSummaries = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: currentUserObjectId }, { recipientId: currentUserObjectId }],
          conversationId: null,
        },
      },
      {
        $addFields: {
          counterpartId: {
            $cond: [{ $eq: ['$senderId', currentUserObjectId] }, '$recipientId', '$senderId'],
          },
          unreadForCurrent: {
            $cond: [
              { $and: [{ $eq: ['$recipientId', currentUserObjectId] }, { $eq: ['$readAt', null] }] },
              1,
              0,
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$counterpartId',
          lastMessage: { $first: '$content' },
          lastMessageAt: { $first: '$createdAt' },
          unreadCount: { $sum: '$unreadForCurrent' },
        },
      },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          lastMessage: 1,
          lastMessageAt: 1,
          unreadCount: 1,
        },
      },
    ]);

    const groupSummaries = await Message.aggregate([
      {
        $match: {
          conversationId: { $ne: null },
          recipientIds: currentUserObjectId,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$content' },
          lastMessageAt: { $first: '$createdAt' },
          unreadCount: {
            $sum: {
              $cond: [{ $and: [{ $ne: ['$senderId', currentUserObjectId] }, { $eq: ['$readAt', null] }] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          conversationId: { $toString: '$_id' },
          lastMessage: 1,
          lastMessageAt: 1,
          unreadCount: 1,
        },
      },
    ]);

    const counterpartObjectIds = directSummaries
      .map((item) => String(item.userId || ''))
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const userMap = counterpartObjectIds.length
      ? await User.find({ _id: { $in: counterpartObjectIds } }, { _id: 1, name: 1 }).lean()
      : [];

    const namesById = new Map(userMap.map((user) => [String(user._id), user.name]));

    const conversationIds = groupSummaries.map((item) => String(item.conversationId || '')).filter(Boolean);
    const conversations = conversationIds.length
      ? await Conversation.find({ _id: { $in: conversationIds } }, { _id: 1, name: 1 }).lean()
      : [];

    const conversationNamesById = new Map(conversations.map((conversation) => [String(conversation._id), conversation.name || 'Group chat']));

    const data = [
      ...directSummaries
        .filter((item) => item.userId !== currentUserId)
        .map((item) => ({
          type: 'direct' as const,
          userId: String(item.userId),
          userName: namesById.get(String(item.userId)) || 'Teammate',
          lastMessage: String(item.lastMessage || ''),
          lastMessageAt: item.lastMessageAt || null,
          unreadCount: Number(item.unreadCount || 0),
        })),
      ...groupSummaries.map((item) => ({
        type: 'group' as const,
        conversationId: String(item.conversationId),
        conversationName: conversationNamesById.get(String(item.conversationId)) || 'Group chat',
        lastMessage: String(item.lastMessage || ''),
        lastMessageAt: item.lastMessageAt || null,
        unreadCount: Number(item.unreadCount || 0),
      })),
    ].sort((left, right) => {
      const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
      const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
      return rightTime - leftTime;
    });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
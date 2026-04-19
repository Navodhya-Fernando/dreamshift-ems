import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Notification from '@/models/Notification';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();

    const userId = (session.user as { id: string }).id;
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 100);

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [items, unreadCount] = await Promise.all([
      Notification.find({ userId: userObjectId }).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ userId: userObjectId, isRead: false }),
    ]);

    const data = items.map((item) => ({
      id: String(item._id),
      type: item.type,
      title: item.title,
      message: item.message,
      link: item.link || null,
      isRead: Boolean(item.isRead),
      readAt: item.readAt || null,
      createdAt: item.createdAt,
    }));

    return NextResponse.json({ success: true, data: { items: data, unreadCount } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();

    const userId = (session.user as { id: string }).id;
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const body = await req.json();

    if (body.markAll) {
      await Notification.updateMany(
        { userId: userObjectId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );
      return NextResponse.json({ success: true, data: {} }, { status: 200 });
    }

    const notificationId = String(body.notificationId || '');
    if (!mongoose.isValidObjectId(notificationId)) {
      return NextResponse.json({ success: false, error: 'Invalid notification id' }, { status: 400 });
    }

    await Notification.updateOne(
      { _id: new mongoose.Types.ObjectId(notificationId), userId: userObjectId },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return NextResponse.json({ success: true, data: {} }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

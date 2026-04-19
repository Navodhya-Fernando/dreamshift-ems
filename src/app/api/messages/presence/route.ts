import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const users = await User.find({}, {
      _id: 1,
      name: 1,
      presenceStatus: 1,
      lastSeenAt: 1,
      activeAt: 1,
    }).lean();

    return NextResponse.json(
      {
        success: true,
        data: users.map((user) => ({
          userId: String(user._id),
          name: user.name,
          presenceStatus: user.presenceStatus || 'OFFLINE',
          lastSeenAt: user.lastSeenAt || null,
          activeAt: user.activeAt || null,
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
    const userId = (session.user as { id: string }).id;
    const body = await req.json().catch(() => ({}));
    const presenceStatus = String(body.presenceStatus || 'ONLINE').toUpperCase();

    if (!['ONLINE', 'AWAY', 'OFFLINE'].includes(presenceStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid presence status' }, { status: 400 });
    }

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          presenceStatus,
          activeAt: new Date(),
          lastSeenAt: presenceStatus === 'OFFLINE' ? new Date() : undefined,
        },
      }
    );

    return NextResponse.json({ success: true, data: { presenceStatus } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

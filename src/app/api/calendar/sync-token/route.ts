import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const userId = (session.user as { id: string }).id;
    const existing = await User.findById(userId, { calendarSyncToken: 1 }).lean();
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let token = String(existing.calendarSyncToken || '').trim();
    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      await User.updateOne({ _id: userId }, { $set: { calendarSyncToken: token } });
    }

    const baseUrl = String(process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '') || new URL(req.url).origin;
    const syncUrl = `${baseUrl}/api/calendar/ics?token=${token}`;

    return NextResponse.json({ success: true, data: { token, syncUrl } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

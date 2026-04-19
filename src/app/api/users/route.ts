import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const users = await User.find({}, {
      name: 1,
      email: 1,
      designation: 1,
      role: 1,
      image: 1,
      linkedinProfilePicUrl: 1,
      presenceStatus: 1,
      lastSeenAt: 1,
      activeAt: 1,
    }).sort({ name: 1 });

    return NextResponse.json({ success: true, data: users }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

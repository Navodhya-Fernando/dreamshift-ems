import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import WorkspaceMember from '@/models/WorkspaceMember';
import User from '@/models/User';

type SessionUser = { id: string };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id: workspaceId } = await params;
    await dbConnect();
    const { email, role } = await req.json();

    // Verify creator is OWNER or ADMIN
    const requester = await WorkspaceMember.findOne({ workspaceId, userId: (session.user as SessionUser).id });
    if (!requester || !['OWNER', 'ADMIN', 'WORKSPACE_ADMIN'].includes(requester.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    // Find the user to invite
    const userToInvite = await User.findOne({ email });
    if (!userToInvite) {
      return NextResponse.json({ success: false, error: 'User with this email not found' }, { status: 404 });
    }

    // Check if already member
    const existing = await WorkspaceMember.findOne({ workspaceId, userId: userToInvite._id });
    if (existing) {
      return NextResponse.json({ success: false, error: 'User is already a member' }, { status: 400 });
    }

    const membership = await WorkspaceMember.create({
      workspaceId,
      userId: userToInvite._id,
      role: role || 'EMPLOYEE'
    });

    return NextResponse.json({ success: true, data: membership }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

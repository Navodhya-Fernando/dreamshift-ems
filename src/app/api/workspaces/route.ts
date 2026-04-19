import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Workspace from '@/models/Workspace';
import WorkspaceMember from '@/models/WorkspaceMember';
import { getAccessibleWorkspaceIds } from '@/lib/tenancy';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);

    const workspaces = await Workspace.find({ _id: { $in: accessibleWorkspaceIds } }).sort({ updatedAt: -1 });

    return NextResponse.json({ success: true, data: workspaces }, { status: 200 });
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
    const { name } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Workspace name is required' }, { status: 400 });
    }
    
    // Create Workspace
    const workspace = await Workspace.create({ name: name.trim(), ownerId: (session.user as { id: string }).id });
    
    // Auto-create OWNER membership
    await WorkspaceMember.create({
      workspaceId: workspace._id,
      userId: (session.user as { id: string }).id,
      role: 'OWNER'
    });

    return NextResponse.json({ success: true, data: workspace }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

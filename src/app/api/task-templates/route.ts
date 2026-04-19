import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import TaskTemplate from '@/models/TaskTemplate';
import { SYSTEM_TASK_TEMPLATES, toTemplateKey } from '@/lib/taskTemplates';

function normalizeSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 30);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const rows = await TaskTemplate.find({ ownerId: userId }).sort({ createdAt: -1 }).lean();

    const custom = rows.map((row) => ({
      key: String(row.key),
      title: String(row.title),
      description: String(row.description || ''),
      steps: normalizeSteps(row.steps),
      isSystem: false,
      createdAt: row.createdAt,
    }));

    return NextResponse.json({ success: true, data: [...SYSTEM_TASK_TEMPLATES, ...custom] }, { status: 200 });
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

    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const steps = normalizeSteps(body.steps);
    const inputKey = String(body.key || '').trim();

    if (!title) {
      return NextResponse.json({ success: false, error: 'Template title is required' }, { status: 400 });
    }

    const baseKey = toTemplateKey(inputKey || title);
    if (!baseKey || baseKey === 'NO_TEMPLATE') {
      return NextResponse.json({ success: false, error: 'Please use a different template title' }, { status: 400 });
    }

    if (SYSTEM_TASK_TEMPLATES.some((item) => item.key === baseKey)) {
      return NextResponse.json({ success: false, error: 'A system template with this key already exists' }, { status: 400 });
    }

    let key = baseKey;
    let suffix = 1;
    while (await TaskTemplate.exists({ ownerId: userId, key })) {
      suffix += 1;
      key = `${baseKey}_${suffix}`;
    }

    const created = await TaskTemplate.create({
      key,
      title,
      description,
      steps,
      ownerId: userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        key: String(created.key),
        title: String(created.title),
        description: String(created.description || ''),
        steps: normalizeSteps(created.steps),
        isSystem: false,
        createdAt: created.createdAt,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

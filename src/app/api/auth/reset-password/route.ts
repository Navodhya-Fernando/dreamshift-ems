import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { checkRateLimit } from '@/lib/rateLimit';

const RESET_LIMIT_PER_15_MIN = 20;
const RESET_WINDOW_MS = 15 * 60_000;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rate = checkRateLimit(`auth:reset-password:${ip}`, RESET_LIMIT_PER_15_MIN, RESET_WINDOW_MS);
    if (!rate.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || '').trim();
    const newPassword = String(body?.newPassword || '');
    const confirmPassword = String(body?.confirmPassword || '');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Reset token is required' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, error: 'Password confirmation does not match' }, { status: 400 });
    }

    await dbConnect();

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: now },
    }).select('+password').lean();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { _id: user._id },
      {
        $set: { password: passwordHash },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpires: 1,
        },
      }
    );

    return NextResponse.json({ success: true, message: 'Password reset successful' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
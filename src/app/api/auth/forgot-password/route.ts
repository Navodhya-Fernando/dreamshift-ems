import crypto from 'crypto';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { sendBrevoEmail } from '@/lib/brevo';
import { checkRateLimit } from '@/lib/rateLimit';

const FORGOT_LIMIT_PER_15_MIN = 8;
const FORGOT_WINDOW_MS = 15 * 60_000;

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getRequestOrigin(req: Request) {
  const envBase = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL;
  if (envBase) return envBase.replace(/\/$/, '');

  const url = new URL(req.url);
  return url.origin;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rate = checkRateLimit(`auth:forgot-password:${ip}`, FORGOT_LIMIT_PER_15_MIN, FORGOT_WINDOW_MS);

    if (!rate.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Never reveal account existence.
    const safeResponse = NextResponse.json(
      { success: true, message: 'If an account exists for this email, a reset link has been sent.' },
      { status: 200 }
    );

    if (!validEmail(email)) {
      return safeResponse;
    }

    await dbConnect();
    const user = await User.findOne({ email }, { _id: 1, email: 1, name: 1, notificationPreferences: 1 }).lean();
    if (!user) return safeResponse;

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 30 * 60_000);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: expires,
        },
      }
    );

    const emailAllowed = Boolean(user.notificationPreferences?.emailNotifications ?? true);
    if (emailAllowed) {
      const resetUrl = `${getRequestOrigin(req)}/auth/reset-password?token=${token}`;
      await sendBrevoEmail({
        toEmail: String(user.email),
        toName: String(user.name || ''),
        subject: 'DreamShift password reset request',
        htmlContent: `<p>You requested a password reset for DreamShift EMS.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes.</p>`,
        textContent: `Reset your DreamShift password: ${resetUrl}`,
      });
    }

    return safeResponse;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
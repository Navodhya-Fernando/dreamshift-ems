import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Notification, { type NotificationType } from '@/models/Notification';
import User from '@/models/User';
import { sendBrevoEmail } from '@/lib/brevo';

type NotifyUserInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  emailSubject?: string;
  emailHtml?: string;
};

export async function notifyUser(input: NotifyUserInput): Promise<void> {
  if (!input.userId || !mongoose.isValidObjectId(input.userId)) return;

  await dbConnect();

  const userObjectId = new mongoose.Types.ObjectId(input.userId);

  await Notification.create({
    userId: userObjectId,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
    metadata: input.metadata,
    isRead: false,
  });

  const targetUser = await User.findById(userObjectId, { email: 1, name: 1 }).lean();
  if (!targetUser?.email) return;

  const htmlContent =
    input.emailHtml ||
    `<p>${input.message}</p>${input.link ? `<p><a href="${input.link}">Open in DreamShift</a></p>` : ''}`;

  await sendBrevoEmail({
    toEmail: String(targetUser.email),
    toName: String(targetUser.name || ''),
    subject: input.emailSubject || input.title,
    htmlContent,
    textContent: input.message,
  });
}

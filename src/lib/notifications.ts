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

type NotifyUserOnceInput = NotifyUserInput & {
  dedupeKey: string;
  dedupeWindowHours?: number;
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

  const targetUser = await User.findById(userObjectId, {
    email: 1,
    name: 1,
    notificationPreferences: 1,
  }).lean();
  if (!targetUser?.email) return;

  const preferences = targetUser.notificationPreferences || {};
  const emailNotificationsEnabled = Boolean(preferences.emailNotifications ?? true);
  if (!emailNotificationsEnabled) return;

  const shouldSendForType =
    input.type === 'assignment'
      ? Boolean(preferences.taskReminders ?? true)
      : input.type === 'deadline'
        ? Boolean(preferences.deadlineAlerts ?? true)
        : input.type === 'mention'
          ? Boolean(preferences.messageNotifications ?? true)
          : true;

  if (!shouldSendForType) return;

  const htmlContent =
    input.emailHtml ||
    `<p>${input.message}</p>${input.link ? `<p><a href="${input.link}">Open in DreamShift</a></p>` : ''}`;

  const sent = await sendBrevoEmail({
    toEmail: String(targetUser.email),
    toName: String(targetUser.name || ''),
    subject: input.emailSubject || input.title,
    htmlContent,
    textContent: input.message,
  });

  if (!sent) {
    console.warn(`Failed to send notification email to ${String(targetUser.email)}`);
  }
}

export async function notifyUserOnce(input: NotifyUserOnceInput): Promise<boolean> {
  if (!input.userId || !mongoose.isValidObjectId(input.userId)) return false;

  const dedupeKey = String(input.dedupeKey || '').trim();
  if (!dedupeKey) return false;

  await dbConnect();

  const userObjectId = new mongoose.Types.ObjectId(input.userId);
  const dedupeWindowHours = Number(input.dedupeWindowHours || 0);
  const createdAfter =
    Number.isFinite(dedupeWindowHours) && dedupeWindowHours > 0
      ? new Date(Date.now() - dedupeWindowHours * 60 * 60 * 1000)
      : null;

  const duplicateFilter: Record<string, unknown> = {
    userId: userObjectId,
    type: input.type,
    'metadata.dedupeKey': dedupeKey,
  };

  if (createdAfter) {
    duplicateFilter.createdAt = { $gte: createdAfter };
  }

  const alreadySent = await Notification.exists(duplicateFilter);
  if (alreadySent) return false;

  await notifyUser({
    ...input,
    metadata: {
      ...(input.metadata || {}),
      dedupeKey,
    },
  });

  return true;
}

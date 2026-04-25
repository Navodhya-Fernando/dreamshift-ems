export type TaskSummaryItem = {
  title: string;
  dueDate?: Date | string | null;
  status?: string;
  priority?: string;
  projectName?: string;
};

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeDueDate(dueDate: Date | null, now = new Date()) {
  if (!dueDate) return 'No deadline set';

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfDue = new Date(dueDate);
  startOfDue.setHours(0, 0, 0, 0);

  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays === 0) return `Today, ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  if (diffDays === 1) return `Tomorrow, ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
  }
  return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseTimeHHMM(value: string) {
  const match = String(value || '').trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return { hour: 7, minute: 45 };
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return { hour, minute };
}

function getLocalDateParts(date: Date, timeZone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const zonePart = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'GMT+0';
  const match = zonePart.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
}

function localDateTimeToUtc(parts: LocalDateParts, timeZone: string) {
  let utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);

  for (let index = 0; index < 3; index += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess), timeZone);
    const nextGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0) - offsetMinutes * 60_000;
    if (nextGuess === utcGuess) break;
    utcGuess = nextGuess;
  }

  return new Date(utcGuess);
}

export function resolveDailySummarySendAt(timeZone: string, preferredTime: string, now = new Date()) {
  const { hour, minute } = parseTimeHHMM(preferredTime);
  const currentLocal = getLocalDateParts(now, timeZone);
  const currentMinutes = currentLocal.hour * 60 + currentLocal.minute;
  const preferredMinutes = hour * 60 + minute;

  const targetDate = new Date(Date.UTC(currentLocal.year, currentLocal.month - 1, currentLocal.day + (currentMinutes >= preferredMinutes ? 1 : 0), hour, minute, 0));
  return localDateTimeToUtc(
    {
      year: targetDate.getUTCFullYear(),
      month: targetDate.getUTCMonth() + 1,
      day: targetDate.getUTCDate(),
      hour: targetDate.getUTCHours(),
      minute: targetDate.getUTCMinutes(),
    },
    timeZone
  );
}

export function getDailySummaryLocalDateKey(sendAt: Date, timeZone: string) {
  const parts = getLocalDateParts(sendAt, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function buildDailyTaskSummaryEmail(input: {
  userName: string;
  tasks: TaskSummaryItem[];
  openTaskCount: number;
  dashboardUrl: string;
}) {
  const items = input.tasks.slice(0, 5);
  const extraCount = Math.max(0, input.openTaskCount - items.length);
  const previewText = 'You have active tasks assigned to you. Here is your agenda...';

  const rows = items.length
    ? items
        .map((task) => {
          const dueDate = toDate(task.dueDate);
          const dueLabel = formatRelativeDueDate(dueDate);
          const projectLabel = task.projectName ? ` • ${escapeHtml(task.projectName)}` : '';
          return `
            <tr>
              <td style="padding:14px 0;border-top:1px solid #E5E7EB;">
                <div style="font-size:15px;font-weight:600;color:#111827;">${escapeHtml(task.title)}</div>
                <div style="font-size:13px;color:#6B7280;margin-top:4px;">Due: ${escapeHtml(dueLabel)}${projectLabel}</div>
              </td>
            </tr>`;
        })
        .join('')
    : `
        <tr>
          <td style="padding:14px 0;border-top:1px solid #E5E7EB;color:#6B7280;font-size:14px;">
            No active tasks are assigned right now.
          </td>
        </tr>`;

  const button = `<a href="${escapeHtml(input.dashboardUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;font-size:14px;">Open in DreamShift</a>`;

  const htmlContent = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#F8FAFC;padding:0;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>
        <div style="max-width:640px;margin:0 auto;padding:32px 20px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
          <div style="background:linear-gradient(135deg,#111827 0%,#1F2937 100%);border-radius:24px 24px 0 0;padding:24px 28px;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9CA3AF;">DreamShift EMS</div>
            <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">Your Daily Task Summary</h1>
          </div>
          <div style="background:#ffffff;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 24px 24px;padding:28px;">
            <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hi ${escapeHtml(input.userName || 'there')},</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">Good morning! Here is a summary of your currently assigned tasks that require your attention.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 10px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;">Your Active Tasks</td>
              </tr>
              ${rows}
            </table>
            <div style="margin-top:18px;font-size:15px;color:#374151;">You currently have <strong>${input.openTaskCount}</strong> open tasks.${extraCount > 0 ? ` Showing the first ${items.length}.` : ''}</div>
            <div style="margin-top:22px;">${button}</div>
            <p style="margin:22px 0 0;font-size:14px;color:#6B7280;line-height:1.6;">Best regards,<br/>The DreamShift Team</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = [
    'DreamShift EMS',
    'Your Daily Task Summary',
    '',
    `Hi ${input.userName || 'there'},`,
    '',
    'Good morning! Here is a summary of your currently assigned tasks that require your attention.',
    '',
    'Your Active Tasks:',
    ...items.map((task) => {
      const dueDate = toDate(task.dueDate);
      return `- ${task.title} — Due: ${formatRelativeDueDate(dueDate)}${task.projectName ? ` (${task.projectName})` : ''}`;
    }),
    items.length === 0 ? '- No active tasks are assigned right now.' : '',
    '',
    `You currently have ${input.openTaskCount} open tasks.${extraCount > 0 ? ` Showing the first ${items.length}.` : ''}`,
    '',
    `Open in DreamShift: ${input.dashboardUrl}`,
    '',
    'Best regards,',
    'The DreamShift Team',
  ].filter(Boolean).join('\n');

  return {
    subject: 'Your Daily Task Summary – DreamShift',
    previewText,
    htmlContent,
    textContent,
  };
}

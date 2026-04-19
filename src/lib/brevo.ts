type BrevoMailInput = {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
};

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.BREVO_FROM_EMAIL || process.env.EMAIL_FROM;
  const senderName = process.env.BREVO_SENDER_NAME || process.env.EMAIL_FROM_NAME || 'DreamShift EMS';

  return { apiKey, senderEmail, senderName };
}

export async function sendBrevoEmail(input: BrevoMailInput): Promise<boolean> {
  const { apiKey, senderEmail, senderName } = getBrevoConfig();
  if (!apiKey || !senderEmail || !input.toEmail) return false;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: input.toEmail,
            name: input.toName || input.toEmail,
          },
        ],
        subject: input.subject,
        htmlContent: input.htmlContent,
        textContent: input.textContent || input.subject,
      }),
      cache: 'no-store',
    });

    return response.ok;
  } catch {
    return false;
  }
}

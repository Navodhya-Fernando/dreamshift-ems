import os
import smtplib
import html
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Environment Variables
def _get_smtp_config():
    smtp_server = os.getenv("SMTP_SERVER", "smtp-relay.brevo.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))

    smtp_user = (
        os.getenv("SMTP_USER")
        or os.getenv("BREVO_SMTP_USER")
        or ("apikey" if os.getenv("BREVO_API_KEY") else None)
    )
    smtp_password = (
        os.getenv("SMTP_PASSWORD")
        or os.getenv("BREVO_SMTP_KEY")
        or os.getenv("BREVO_API_KEY")
    )

    sender_email = os.getenv("SENDER_EMAIL") or os.getenv("BREVO_FROM_EMAIL", "noreply@dreamshift.net")
    sender_name = os.getenv("SENDER_NAME") or os.getenv("BREVO_FROM_NAME", "DreamShift")

    return smtp_server, smtp_port, smtp_user, smtp_password, sender_email, sender_name

def send_email(to_email, subject, html_content):
    """
    Generic internal function to send an email. 
    Returns True if successful, False otherwise.
    """
    smtp_server, smtp_port, smtp_user, smtp_password, sender_email, sender_name = _get_smtp_config()

    if not smtp_password or not smtp_user or not to_email:
        print(f"⚠️ Email skipped: configuration missing or no recipient. (To: {to_email})")
        return False

    msg = MIMEMultipart()
    sender_display = f"{sender_name} <{sender_email}>" if sender_name else sender_email
    msg['From'] = sender_display
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(html_content, 'html'))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(sender_email, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Email failed: {e}")
        return False

# --- SPECIFIC NOTIFICATION FUNCTIONS ---

def _wrap_email(title, body_html):
        return f"""
        <!doctype html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
                @media only screen and (max-width: 600px) {{
                    .container {{ width: 100% !important; padding: 16px !important; }}
                    .btn {{ display: block !important; width: 100% !important; text-align: center !important; }}
                    .content {{ padding: 20px !important; }}
                }}
            </style>
        </head>
        <body style="margin:0; padding:0; background:#0f0b12;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0b12; padding: 24px 0;">
                <tr>
                    <td align="center">
                        <table role="presentation" width="600" cellspacing="0" cellpadding="0" class="container" style="width:600px; max-width:600px; background:#1b1222; border-radius:16px; overflow:hidden;">
                            <tr>
                                <td style="padding: 24px 28px; background:#24122f; color:#f6b900; font-family: Arial, sans-serif; font-size: 18px; font-weight:700;">
                                    {html.escape(title)}
                                </td>
                            </tr>
                            <tr>
                                <td class="content" style="padding: 28px; color:#e7e3ee; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">
                                    {body_html}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 16px 28px 24px; color:#988aa3; font-family: Arial, sans-serif; font-size: 12px;">
                                    © DreamShift
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """


def send_password_reset_email(to_email, reset_link):
        subject = "Reset Your Password - DreamShift"
        body = f"""
            <p>We received a request to reset your password. Click the button below to proceed.</p>
            <p style="margin: 18px 0;">
                <a class="btn" href="{reset_link}" style="background-color:#f6b900; color:#121212; padding:12px 18px; text-decoration:none; border-radius:8px; font-weight:700; display:inline-block;">
                    Reset Password
                </a>
            </p>
            <p style="font-size:12px; color:#b7a8c4;">If you did not request this, you can ignore this email.</p>
        """
        return send_email(to_email, subject, _wrap_email("Password Reset", body))

def send_task_assignment_email(to_email, task_title, assigner_name, due_date):
        subject = f"New Task Assigned: {task_title}"
        due_text = "No due date"
        if due_date:
                try:
                        due_text = due_date.strftime("%b %d, %Y")
                except Exception:
                        due_text = str(due_date)

        app_url = os.getenv("APP_BASE_URL", "").rstrip("/")
        tasks_link = f"{app_url}/tasks" if app_url else ""
        button_html = ""
        if tasks_link:
                button_html = f"""
                    <p style=\"margin: 18px 0;\">
                        <a class=\"btn\" href=\"{tasks_link}\" style=\"background-color:#f6b900; color:#121212; padding:12px 18px; text-decoration:none; border-radius:8px; font-weight:700; display:inline-block;\">
                            View Task
                        </a>
                    </p>
                """

        body = f"""
            <p><b>{html.escape(assigner_name)}</b> assigned you a task.</p>
            <div style="background:#261730; border-radius:12px; padding:16px; margin:12px 0;">
                <div style="font-size:13px; color:#b7a8c4;">Task</div>
                <div style="font-size:16px; font-weight:700; color:#fff;">{html.escape(task_title)}</div>
                <div style="margin-top:8px; font-size:13px; color:#b7a8c4;">Due: {html.escape(due_text)}</div>
            </div>
            {button_html}
            <p style="font-size:12px; color:#b7a8c4;">Log in to DreamShift to view details.</p>
        """
        return send_email(to_email, subject, _wrap_email("New Assignment", body))

def send_mention_email(to_email, source_user, entity_label, comment_text, app_url=None):
        subject = f"You were mentioned in {entity_label} - DreamShift"
        safe_text = html.escape((comment_text or "").strip())
        if len(safe_text) > 200:
                safe_text = safe_text[:200] + "…"
        app_url = app_url or ""
        button_html = ""
        if app_url:
                button_html = f"""
                    <p style=\"margin: 18px 0;\">
                        <a class=\"btn\" href=\"{app_url}\" style=\"background-color:#f6b900; color:#121212; padding:12px 18px; text-decoration:none; border-radius:8px; font-weight:700; display:inline-block;\">
                            Open DreamShift
                        </a>
                    </p>
                """
        body = f"""
            <p><b>{html.escape(source_user)}</b> mentioned you in <b>{html.escape(entity_label)}</b>.</p>
            <div style="border-left:4px solid #f6b900; padding-left:12px; margin:12px 0; color:#d8cfe2;">
                {safe_text or "(No preview)"}
            </div>
            {button_html}
            <p style="font-size:12px; color:#b7a8c4;">If you did not expect this email, you can ignore it.</p>
        """
        return send_email(to_email, subject, _wrap_email("Mentioned", body))
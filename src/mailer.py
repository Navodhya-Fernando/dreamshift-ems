import os
import smtplib
import html
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Environment Variables
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))

SMTP_USER = (
    os.getenv("SMTP_USER")
    or os.getenv("BREVO_SMTP_USER")
    or ("apikey" if os.getenv("BREVO_API_KEY") else None)
)
SMTP_PASSWORD = (
    os.getenv("SMTP_PASSWORD")
    or os.getenv("BREVO_SMTP_KEY")
    or os.getenv("BREVO_API_KEY")
)

SENDER_EMAIL = os.getenv("SENDER_EMAIL") or os.getenv("BREVO_FROM_EMAIL", "noreply@dreamshift.net")
SENDER_NAME = os.getenv("SENDER_NAME") or os.getenv("BREVO_FROM_NAME", "DreamShift")

def send_email(to_email, subject, html_content):
    """
    Generic internal function to send an email. 
    Returns True if successful, False otherwise.
    """
    if not SMTP_PASSWORD or not SMTP_USER or not to_email:
        print(f"⚠️ Email skipped: configuration missing or no recipient. (To: {to_email})")
        return False

    msg = MIMEMultipart()
    sender_display = f"{SENDER_NAME} <{SENDER_EMAIL}>" if SENDER_NAME else SENDER_EMAIL
    msg['From'] = sender_display
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(html_content, 'html'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Email failed: {e}")
        return False

# --- SPECIFIC NOTIFICATION FUNCTIONS ---

def send_password_reset_email(to_email, reset_link):
    subject = "Reset Your Password - DreamShift"
    html = f"""
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. Click the link below to proceed:</p>
        <p>
            <a href="{reset_link}" style="background-color: #f6b900; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Reset Password
            </a>
        </p>
        <p style="font-size: 12px; color: #777;">If you did not request this, please ignore this email.</p>
    </div>
    """
    return send_email(to_email, subject, html)

def send_task_assignment_email(to_email, task_title, assigner_name, due_date):
    subject = f"New Task Assigned: {task_title}"
    due_text = "No due date"
    if due_date:
        try:
            due_text = due_date.strftime("%b %d, %Y")
        except Exception:
            due_text = str(due_date)
    html = f"""
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #f6b900;">New Assignment</h2>
        <p><b>{assigner_name}</b> has assigned you a new task.</p>
        <hr>
        <p><b>Task:</b> {task_title}</p>
        <p><b>Due:</b> {due_text}</p>
        <hr>
        <p>Log in to DreamShift to view details.</p>
    </div>
    """
    return send_email(to_email, subject, html)

def send_mention_email(to_email, source_user, entity_label, comment_text, app_url=None):
    subject = f"You were mentioned in {entity_label} - DreamShift"
    safe_text = html.escape((comment_text or "").strip())
    if len(safe_text) > 200:
        safe_text = safe_text[:200] + "…"
    app_url = app_url or ""
    button_html = ""
    if app_url:
        button_html = f"""
        <p>
            <a href=\"{app_url}\" style=\"background-color: #f6b900; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;\">
                Open DreamShift
            </a>
        </p>
        """
    html_body = f"""
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #f6b900;">You were mentioned</h2>
        <p><b>{source_user}</b> mentioned you in <b>{html.escape(entity_label)}</b>.</p>
        <div style="border-left: 4px solid #f6b900; padding-left: 12px; margin: 12px 0; color: #555;">
            {safe_text or "(No preview)"}
        </div>
        {button_html}
        <p style="font-size: 12px; color: #777;">If you did not expect this email, you can ignore it.</p>
    </div>
    """
    return send_email(to_email, subject, html_body)
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Environment Variables
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("BREVO_FROM_EMAIL") 
SMTP_PASSWORD = os.getenv("BREVO_API_KEY") 
SENDER_EMAIL = os.getenv("BREVO_FROM_EMAIL", "noreply@dreamshift.net")

def send_email(to_email, subject, html_content):
    """
    Generic internal function to send an email. 
    Returns True if successful, False otherwise.
    """
    if not SMTP_PASSWORD or not to_email:
        print(f"⚠️ Email skipped: configuration missing or no recipient. (To: {to_email})")
        return False

    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
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
        print(f"❌ Email Failed: {e}")
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
    html = f"""
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #f6b900;">New Assignment</h2>
        <p><b>{assigner_name}</b> has assigned you a new task.</p>
        <hr>
        <p><b>Task:</b> {task_title}</p>
        <p><b>Due Date:</b> {due_date if due_date else "No Deadline"}</p>
        <hr>
        <p>Log in to DreamShift to view details.</p>
    </div>
    """
    return send_email(to_email, subject, html)
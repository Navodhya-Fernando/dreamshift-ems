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
    if not SMTP_PASSWORD:
        print("⚠️ Email skipped: configuration missing.")
        return

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
    except Exception as e:
        print(f"❌ Email Failed: {e}")

def notify_deadline_warning(user_email, task_title, due_date):
    html = f"<p>Task <b>{task_title}</b> is due on {due_date}.</p>"
    send_email(user_email, f"Deadline Alert: {task_title}", html)

def notify_admins_extension(admin_emails, task_title, requester_email, reason):
    html = f"""
    <h3>📅 Extension Request</h3>
    <p><b>User:</b> {requester_email}</p>
    <p><b>Task:</b> {task_title}</p>
    <p><b>Reason:</b> {reason}</p>
    <p>Please check the admin panel to approve/reject.</p>
    """
    for email in admin_emails:
        send_email(email, f"Extension Request: {task_title}", html)
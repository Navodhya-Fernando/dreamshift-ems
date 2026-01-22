import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from src.database import DreamShiftDB

# Config
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "noreply@dreamshift.net")

def send_email(to_email, subject, html_content):
    if not SMTP_USER or not SMTP_PASSWORD:
        print("⚠️ SMTP not configured. Email skipped.")
        return

    msg = MIMEMultipart()
    msg['From'] = f"DreamShift EMS <{SENDER_EMAIL}>"
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
        print(f"❌ Email failed: {e}")

# --- TRIGGER FUNCTIONS ---

def check_deadlines_and_notify():
    """Call this on Home Page load to check for <24h tasks"""
    db = DreamShiftDB()
    # Find tasks due in next 24h that are not completed
    # (Implementation simplified for brevity)
    pass 

def alert_admin_extension(admin_email, task_title, requester, reason):
    html = f"""
    <h3>📅 Deadline Extension Request</h3>
    <p><b>User:</b> {requester}</p>
    <p><b>Task:</b> {task_title}</p>
    <p><b>Reason:</b> {reason}</p>
    <a href='https://dreamshift.net'>Review Request</a>
    """
    send_email(admin_email, f"Extension Request: {task_title}", html)

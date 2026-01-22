import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Mapped from your .env structure
SMTP_SERVER = "smtp-relay.brevo.com"
SMTP_PORT = 587
# Uses the 'From' email as the username usually, or needs specific SMTP key
SMTP_USER = os.getenv("BREVO_FROM_EMAIL") 
# Uses the API Key as password (common for Brevo/Sendinblue SMTP)
SMTP_PASSWORD = os.getenv("BREVO_API_KEY") 

SENDER_EMAIL = os.getenv("BREVO_FROM_EMAIL", "noreply@dreamshift.net")
SENDER_NAME = os.getenv("BREVO_FROM_NAME", "DreamShift Admin")

def send_email(to_email, subject, html_content):
    if not SMTP_PASSWORD:
        print("⚠️ Email skipped: BREVO_API_KEY missing.")
        return

    msg = MIMEMultipart()
    msg['From'] = f"{SENDER_NAME} <{SENDER_EMAIL}>"
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

# Helper for Deadline Alerts
def notify_deadline_warning(user_email, task_title, due_date):
    html = f"""
    <h3>⏳ Task Due Soon</h3>
    <p><b>Task:</b> {task_title}</p>
    <p><b>Due:</b> {due_date}</p>
    <p>Please submit your work on time.</p>
    """
    send_email(user_email, f"Due Soon: {task_title}", html)
"""
Email notification system for DreamShift EMS
Supports SendInBlue/Brevo for sending emails
"""

import os
from dotenv import load_dotenv

load_dotenv()

def send_email(to_email, subject, html_content):
    """
    Send an email notification using SendInBlue/Brevo API
    
    Args:
        to_email (str): Recipient email address
        subject (str): Email subject
        html_content (str): HTML content of the email
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    # Try both environment variable names
    api_key = os.getenv('BREVO_API_KEY') or os.getenv('SENDINBLUE_API_KEY')
    from_email = os.getenv('BREVO_FROM_EMAIL', 'noreply@dreamshift.app')
    from_name = os.getenv('BREVO_FROM_NAME', 'DreamShift EMS')
    
    if not api_key:
        print("⚠️ BREVO_API_KEY or SENDINBLUE_API_KEY not configured. Email not sent.")
        print(f"Would have sent to {to_email}: {subject}")
        return False
    
    try:
        import sib_api_v3_sdk
        from sib_api_v3_sdk.rest import ApiException
        
        # Configure API
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = api_key
        
        api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )
        
        # Prepare email
        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": to_email}],
            sender={"email": from_email, "name": from_name},
            subject=subject,
            html_content=html_content
        )
        
        # Send email
        api_instance.send_transac_email(send_smtp_email)
        print(f"✅ Email sent to {to_email}: {subject}")
        return True
        
    except ApiException as e:
        print(f"❌ Error sending email: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


def send_task_assigned_email(to_email, task_title, task_url, assigned_by):
    """Send notification when a task is assigned."""
    subject = f"New Task Assigned: {task_title}"
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #4F46E5;">📋 New Task Assigned</h2>
                <p>You have been assigned a new task:</p>
                <div style="background: #EEF2FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0; color: #1F2937;">{task_title}</h3>
                </div>
                <p>Assigned by: <strong>{assigned_by}</strong></p>
                <a href="{task_url}" style="display: inline-block; background: #4F46E5; color: white; 
                   padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                    View Task
                </a>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 14px;">
                    DreamShift EMS - Project & Employee Management System
                </p>
            </div>
        </body>
    </html>
    """
    return send_email(to_email, subject, html_content)


def send_mention_email(to_email, mentioned_by, comment_text, entity_type, entity_name, url):
    """Send notification when someone is @mentioned."""
    subject = f"You were mentioned by {mentioned_by}"
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #4F46E5;">💬 You were mentioned</h2>
                <p><strong>{mentioned_by}</strong> mentioned you in a comment on {entity_type} "{entity_name}":</p>
                <div style="background: #F9FAFB; padding: 15px; border-radius: 8px; margin: 20px 0; 
                            border-left: 4px solid #4F46E5;">
                    <p style="margin: 0; color: #374151;">{comment_text}</p>
                </div>
                <a href="{url}" style="display: inline-block; background: #4F46E5; color: white; 
                   padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                    View & Reply
                </a>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 14px;">
                    DreamShift EMS - Project & Employee Management System
                </p>
            </div>
        </body>
    </html>
    """
    return send_email(to_email, subject, html_content)


def send_deadline_reminder_email(to_email, task_title, due_date, days_remaining):
    """Send deadline reminder email."""
    urgency = "⚠️ URGENT" if days_remaining <= 1 else "📅 Reminder"
    subject = f"{urgency}: Task due {'today' if days_remaining == 0 else f'in {days_remaining} days'}"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: {'#EF4444' if days_remaining <= 1 else '#F59E0B'};">{urgency} Deadline Approaching</h2>
                <p>Your task is due {'today' if days_remaining == 0 else f'in {days_remaining} days'}:</p>
                <div style="background: {'#FEF2F2' if days_remaining <= 1 else '#FFFBEB'}; padding: 15px; 
                            border-radius: 8px; margin: 20px 0; border-left: 4px solid {'#EF4444' if days_remaining <= 1 else '#F59E0B'};">
                    <h3 style="margin: 0; color: #1F2937;">{task_title}</h3>
                    <p style="margin: 10px 0 0 0; color: #6B7280;">Due: {due_date}</p>
                </div>
                <p>Make sure to complete this task on time or request an extension if needed.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 14px;">
                    DreamShift EMS - Project & Employee Management System
                </p>
            </div>
        </body>
    </html>
    """
    return send_email(to_email, subject, html_content)


def send_extension_request_email(to_email, requester, task_title, new_deadline, reason):
    """Send email to admin about extension request."""
    subject = f"Extension Request: {task_title}"
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #4F46E5;">📅 Deadline Extension Request</h2>
                <p><strong>{requester}</strong> has requested a deadline extension for:</p>
                <div style="background: #EEF2FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0; color: #1F2937;">{task_title}</h3>
                    <p style="margin: 10px 0 0 0; color: #6B7280;">New deadline requested: {new_deadline}</p>
                </div>
                <p><strong>Reason:</strong></p>
                <p style="background: #F9FAFB; padding: 15px; border-radius: 8px;">{reason}</p>
                <p>Please review and approve or reject this request in the Admin Panel.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 14px;">
                    DreamShift EMS - Project & Employee Management System
                </p>
            </div>
        </body>
    </html>
    """
    return send_email(to_email, subject, html_content)


def send_extension_response_email(to_email, task_title, approved, reason=""):
    """Send email about extension request decision."""
    if approved:
        subject = f"Extension Approved: {task_title}"
        color = "#10B981"
        status = "✅ Approved"
        message = "Your deadline extension request has been approved."
    else:
        subject = f"Extension Rejected: {task_title}"
        color = "#EF4444"
        status = "❌ Rejected"
        message = f"Your deadline extension request has been rejected. {reason}"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: {color};">{status} Extension Request</h2>
                <p>{message}</p>
                <div style="background: #F9FAFB; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0; color: #1F2937;">{task_title}</h3>
                </div>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 14px;">
                    DreamShift EMS - Project & Employee Management System
                </p>
            </div>
        </body>
    </html>
    """
    return send_email(to_email, subject, html_content)


def send_daily_digest_email(to_email, tasks_due_today, tasks_due_this_week, overdue_tasks):
    """Send daily digest of tasks."""
    subject = f"Daily Task Digest - {len(tasks_due_today)} tasks due today"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #4F46E5;">📊 Daily Task Digest</h2>
                
                <div style="margin: 20px 0;">
                    <h3 style="color: #EF4444;">⚠️ Due Today ({len(tasks_due_today)})</h3>
                    {''.join([f'<p style="background: #FEF2F2; padding: 10px; border-radius: 4px;">• {task}</p>' for task in tasks_due_today]) if tasks_due_today else '<p>No tasks due today</p>'}
                </div>
                
                <div style="margin: 20px 0;">
                    <h3 style="color: #F59E0B;">📅 Due This Week ({len(tasks_due_this_week)})</h3>
                    {''.join([f'<p style="background: #FFFBEB; padding: 10px; border-radius: 4px;">• {task}</p>' for task in tasks_due_this_week[:5]]) if tasks_due_this_week else '<p>No tasks due this week</p>'}
                </div>
                
                {f'''
                <div style="margin: 20px 0;">
                    <h3 style="color: #DC2626;">🚨 Overdue ({len(overdue_tasks)})</h3>
                    {''.join([f'<p style="background: #FEE2E2; padding: 10px; border-radius: 4px;">• {task}</p>' for task in overdue_tasks[:5]])}
                </div>
                ''' if overdue_tasks else ''}
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 14px;">
                    DreamShift EMS - Project & Employee Management System
                </p>
            </div>
        </body>
    </html>
    """
    return send_email(to_email, subject, html_content)
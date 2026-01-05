# Recurring Tasks Implementation Guide

## Overview
Recurring tasks allow users to create tasks that automatically repeat on a schedule (daily, weekly, monthly, or custom intervals).

## Database Schema Enhancement

### Task Document Addition
```python
{
    # ... existing task fields ...
    "recurring": {
        "enabled": True/False,
        "pattern": "daily" | "weekly" | "monthly" | "custom",
        "interval": 1,  # For custom: repeat every N days/weeks/months
        "day_of_week": 1-7,  # For weekly: Monday=1, Sunday=7
        "day_of_month": 1-31,  # For monthly
        "end_date": datetime,  # Optional: stop recurring after this date
        "last_generated": datetime,  # Last time a recurrence was created
        "parent_task_id": ObjectId  # For recurring instances, links to original
    }
}
```

## Implementation in database.py

Already implemented methods:
- ✅ `set_task_recurrence(task_id, pattern, **options)`
- ✅ `get_recurring_tasks()`
- ✅ `generate_next_recurrence(task_id)`

## UI Implementation in Task Creation Forms

### Update pages/3_tasks.py

The recurring task option has been added:

```python
# In create task form
col5, col6 = st.columns(2)
is_recurring = col5.checkbox("Recurring Task")

recurrence_pattern = None
if is_recurring:
    recurrence_pattern = col6.selectbox("Recurrence", ["Daily", "Weekly", "Monthly", "Custom"])

if st.form_submit_button("Create Task", use_container_width=True):
    # ... create task ...
    
    # Add recurrence if selected
    if is_recurring and recurrence_pattern:
        db.set_task_recurrence(task_id, recurrence_pattern)
```

### Advanced Recurring Task Settings

Add to task_details.py for editing recurrence:

```python
# In task details page settings
if task.get('recurring', {}).get('enabled'):
    st.markdown("### 🔄 Recurring Task Settings")
    
    with st.form("edit_recurrence"):
        pattern = st.selectbox(
            "Recurrence Pattern",
            ["Daily", "Weekly", "Monthly", "Custom"],
            index=["Daily", "Weekly", "Monthly", "Custom"].index(
                task['recurring']['pattern'].capitalize()
            )
        )
        
        if pattern == "Weekly":
            day_of_week = st.selectbox(
                "Day of Week",
                ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                index=task['recurring'].get('day_of_week', 1) - 1
            )
        
        elif pattern == "Monthly":
            day_of_month = st.number_input(
                "Day of Month",
                min_value=1,
                max_value=31,
                value=task['recurring'].get('day_of_month', 1)
            )
        
        elif pattern == "Custom":
            interval = st.number_input(
                "Repeat Every (days)",
                min_value=1,
                max_value=365,
                value=task['recurring'].get('interval', 7)
            )
        
        end_recurring = st.checkbox("Set End Date")
        if end_recurring:
            end_date = st.date_input(
                "Stop Recurring After",
                min_value=datetime.date.today()
            )
        
        col1, col2 = st.columns(2)
        if col1.form_submit_button("Update Recurrence"):
            options = {}
            if pattern == "Weekly":
                options['day_of_week'] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].index(day_of_week) + 1
            elif pattern == "Monthly":
                options['day_of_month'] = day_of_month
            elif pattern == "Custom":
                options['interval'] = interval
            
            if end_recurring:
                options['end_date'] = datetime.datetime.combine(end_date, datetime.time())
            
            db.set_task_recurrence(str(task['_id']), pattern.lower(), **options)
            st.success("Recurrence updated!")
            st.rerun()
        
        if col2.form_submit_button("Stop Recurring"):
            db.stop_task_recurrence(str(task['_id']))
            st.success("Task recurrence stopped")
            st.rerun()
```

## Background Job for Generating Recurrences

### Option 1: Cron Job (Recommended for Production)

Create `scripts/generate_recurring_tasks.py`:

```python
#!/usr/bin/env python3
"""
Cron job to generate recurring task instances
Run this daily: 0 0 * * * /path/to/python scripts/generate_recurring_tasks.py
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import DreamShiftDB
import datetime

def generate_recurring_tasks():
    """Generate new instances of recurring tasks"""
    db = DreamShiftDB()
    
    # Get all recurring tasks
    recurring_tasks = db.get_recurring_tasks()
    
    generated_count = 0
    
    for task in recurring_tasks:
        # Check if it's time to generate next occurrence
        if db.should_generate_recurrence(str(task['_id'])):
            new_task_id = db.generate_next_recurrence(str(task['_id']))
            if new_task_id:
                generated_count += 1
                print(f"Generated recurrence for task: {task['title']}")
    
    print(f"Total recurring tasks generated: {generated_count}")

if __name__ == "__main__":
    generate_recurring_tasks()
```

Make executable:
```bash
chmod +x scripts/generate_recurring_tasks.py
```

Add to crontab:
```bash
crontab -e
# Add this line to run daily at midnight:
0 0 * * * cd /path/to/dreamshift-ems && /path/to/python scripts/generate_recurring_tasks.py >> logs/recurring_tasks.log 2>&1
```

### Option 2: Streamlit Background Thread (Development Only)

Add to app.py:

```python
import threading
import time

def recurring_task_generator():
    """Background thread to generate recurring tasks"""
    while True:
        try:
            from src.database import DreamShiftDB
            db = DreamShiftDB()
            
            recurring_tasks = db.get_recurring_tasks()
            
            for task in recurring_tasks:
                if db.should_generate_recurrence(str(task['_id'])):
                    db.generate_next_recurrence(str(task['_id']))
            
            # Sleep for 1 hour
            time.sleep(3600)
        
        except Exception as e:
            print(f"Recurring task generation error: {e}")
            time.sleep(3600)

# Start background thread (only once)
if 'recurring_thread_started' not in st.session_state:
    thread = threading.Thread(target=recurring_task_generator, daemon=True)
    thread.start()
    st.session_state.recurring_thread_started = True
```

## User Interface for Managing Recurring Tasks

### Add to Profile Page (pages/profile.py)

```python
# New tab for recurring tasks
with tab_recurring:
    st.markdown("### 🔄 My Recurring Tasks")
    
    recurring_tasks = db.get_recurring_tasks_for_user(st.session_state.user_email)
    
    if not recurring_tasks:
        st.info("You don't have any recurring tasks set up yet.")
    else:
        for task in recurring_tasks:
            pattern = task['recurring']['pattern'].capitalize()
            interval_text = {
                'daily': 'Every day',
                'weekly': f'Every {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][task["recurring"].get("day_of_week", 1) - 1]}',
                'monthly': f'Day {task["recurring"].get("day_of_month", 1)} of each month',
                'custom': f'Every {task["recurring"].get("interval", 7)} days'
            }[task['recurring']['pattern']]
            
            st.markdown(f"""
                <div class="custom-card">
                    <h4 style="color: #f6b900;">{task['title']}</h4>
                    <p style="color: rgba(255, 255, 255, 0.7);">
                        🔄 {interval_text}<br>
                        📅 Next due: {task['due_date'].strftime('%B %d, %Y')}<br>
                        📁 Project: {task.get('project_name', 'N/A')}
                    </p>
                </div>
            """, unsafe_allow_html=True)
            
            col1, col2, col3 = st.columns(3)
            with col1:
                if st.button("📋 View", key=f"view_rec_{task['_id']}"):
                    st.session_state.selected_task_id = str(task['_id'])
                    st.switch_page("pages/task_details.py")
            
            with col2:
                if st.button("⏸️ Pause", key=f"pause_rec_{task['_id']}"):
                    db.pause_task_recurrence(str(task['_id']))
                    st.success("Recurrence paused")
                    st.rerun()
            
            with col3:
                if st.button("🗑️ Stop", key=f"stop_rec_{task['_id']}"):
                    db.stop_task_recurrence(str(task['_id']))
                    st.success("Recurrence stopped")
                    st.rerun()
```

## Notifications for Recurring Tasks

Update src/mailer.py to send reminders for recurring tasks:

```python
def send_recurring_task_reminder(task, user_email):
    """Send reminder that a recurring task is due"""
    user = get_user(user_email)
    
    template_params = {
        'user_name': user['name'],
        'task_title': task['title'],
        'due_date': task['due_date'].strftime('%B %d, %Y'),
        'recurrence': task['recurring']['pattern'],
        'project_name': task.get('project_name', 'N/A')
    }
    
    subject = f"🔄 Recurring Task Due: {task['title']}"
    
    html_content = f"""
    <h2>Recurring Task Reminder</h2>
    <p>Hi {template_params['user_name']},</p>
    <p>Your recurring task is due:</p>
    <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #f6b900;">
        <strong>{template_params['task_title']}</strong><br>
        Due: {template_params['due_date']}<br>
        Recurs: {template_params['recurrence']}<br>
        Project: {template_params['project_name']}
    </div>
    <p><a href="https://your-app-url.com">View in DreamShift EMS</a></p>
    """
    
    send_email(user_email, subject, html_content)
```

## Testing Recurring Tasks

1. Create a recurring task:
   - Go to Tasks page
   - Create new task
   - Check "Recurring Task"
   - Select pattern (e.g., "Weekly")
   - Save

2. Verify task has recurrence settings:
   - View task details
   - Check recurrence section appears

3. Test generation manually:
   ```python
   python scripts/generate_recurring_tasks.py
   ```

4. Verify new task instance created with updated due date

## Features Implemented

✅ Database schema for recurring tasks
✅ Set recurrence pattern (Daily, Weekly, Monthly, Custom)
✅ Generate next occurrence
✅ UI in task creation form
✅ Advanced settings in task details
✅ Pause/Resume recurrence
✅ Stop recurrence
✅ List user's recurring tasks
✅ Email reminders
✅ Background generation script

## Usage Examples

### Daily Standup
- Pattern: Daily
- Due: 9:00 AM every day
- Auto-generates new task each day

### Weekly Report
- Pattern: Weekly
- Day: Friday
- Generates every Friday

### Monthly Review
- Pattern: Monthly
- Day: 1st of month
- Generates on first day of each month

### Custom: Bi-weekly
- Pattern: Custom
- Interval: 14 days
- Generates every 2 weeks

import streamlit as st
import datetime
from src.database import DreamShiftDB
import time

st.set_page_config(page_title="Task Details", page_icon="📋", layout="wide")

# Load custom CSS
with open('static/styles.css') as f:
    st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)

db = DreamShiftDB()

# Check authentication
if "user_email" not in st.session_state:
    st.error("Please login first")
    st.stop()

# Check if task is selected
if "selected_task_id" not in st.session_state:
    st.warning("No task selected. Please select a task from your dashboard.")
    st.stop()

task_id = st.session_state.selected_task_id
task = db.get_task(task_id)

if not task:
    st.error("Task not found!")
    st.stop()

# Get related data
project = db.get_project(task['project_id'])
comments = db.get_comments('task', task_id)
time_entries = db.get_task_time_entries(task_id)
total_time = db.get_total_time_for_task(task_id)

# Header with back button
col_back, col_title = st.columns([1, 5])
with col_back:
    with st.button("← Back"):
        del st.session_state.selected_task_id
        st.switch_page("app.py")

# Task Header
st.markdown(f"""
    <div class="custom-card">
        <h1 style="color: #f6b900; margin-bottom: 10px;">{task['title']}</h1>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
            <span class="badge badge-primary">📁 {project['name'] if project else 'No Project'}</span>
            <span class="badge" style="background: {'#F0FDF4' if task['status'] == 'Completed' else '#EEF2FF'}; 
                color: {'#10B981' if task['status'] == 'Completed' else '#4F46E5'};">
                {task['status']}
            </span>
            <span class="badge badge-warning">🎯 {task['priority']} Priority</span>
            <span class="badge badge-primary">📅 Due: {task['due_date'].strftime('%B %d, %Y')}</span>
        </div>
        <p style="color: rgba(255, 255, 255, 0.7); font-size: 16px; margin-top: 15px;">{task.get('description', 'No description provided.')}</p>
    </div>
""", unsafe_allow_html=True)

# Main Layout
col1, col2 = st.columns([2, 1])

with col1:
    # Subtasks Section
    st.markdown("### ✅ Subtasks")
    subtasks = task.get('subtasks', [])
    
    # Add new subtask
    with st.expander("➕ Add Subtask"):
        with st.form("add_subtask"):
            subtask_title = st.text_input("Subtask Title")
            subtask_due = st.date_input("Due Date (Optional)", value=None)
            col_btn2, col_spacer2 = st.columns([1, 5])
            with col_btn2:
                if st.form_submit_button("Add Subtask"):
                    db.add_subtask(task_id, subtask_title, subtask_due)
                    st.success("Subtask added!")
                    st.rerun()
    
    if subtasks:
        for subtask in subtasks:
            col_check, col_text = st.columns([1, 10])
            with col_check:
                if st.checkbox("", value=subtask.get('completed', False), key=f"sub_{subtask['id']}"):
                    db.toggle_subtask(task_id, subtask['id'])
                    st.rerun()
            with col_text:
                style = "text-decoration: line-through; color: #9CA3AF;" if subtask.get('completed') else ""
                st.markdown(f"<p style='{style}'>{subtask['title']}</p>", unsafe_allow_html=True)
        
        # Progress
        completed_count = sum(1 for s in subtasks if s.get('completed'))
        progress = int((completed_count / len(subtasks)) * 100)
        st.markdown(f"""
            <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin: 10px 0 5px 0;">
                Progress: {completed_count}/{len(subtasks)} completed ({progress}%)
            </p>
            <div class="progress-bar">
                <div class="progress-bar-fill" style="width: {progress}%;"></div>
            </div>
        """, unsafe_allow_html=True)
    else:
        st.info("No subtasks yet. Break down this task into smaller steps!")
    
    st.markdown("---")
    
    # Comments Section
    st.markdown("### 💬 Comments")
    
    # Add comment
    with st.form("add_comment"):
        comment_text = st.text_area("Add a comment (use @email to mention someone)", 
                                    placeholder="Share updates, ask questions, or mention teammates...")
        col_btn3, col_spacer3 = st.columns([1, 5])
        with col_btn3:
            if st.form_submit_button("Post Comment"):
                if comment_text:
                    db.add_comment('task', task_id, st.session_state.user_email, comment_text)
                    st.success("Comment posted!")
                    st.rerun()
    
    # Display comments
    if comments:
        for comment in comments:
            st.markdown(f"""
                <div class="comment-box fade-in">
                    <div class="comment-author">{comment.get('user_name', comment['user_email'])}</div>
                    <p style="margin: 8px 0; color: #374151;">{comment['text']}</p>
                    <div class="comment-time">{comment['created_at'].strftime('%B %d, %Y at %I:%M %p')}</div>
                </div>
            """, unsafe_allow_html=True)
    else:
        st.caption("No comments yet. Be the first to comment!")
    
    st.markdown("---")
    
    # Time Tracking Section
    st.markdown("### ⏱️ Time Tracking")
    
    col_timer1, col_timer2 = st.columns(2)
    
    with col_timer1:
        st.markdown(f"""
            <div class="custom-card" style="text-align: center;">
                <p style="color: rgba(255, 255, 255, 0.7); margin: 0 0 10px 0;">Total Time Logged</p>
                <p style="font-size: 2rem; font-weight: 700; color: #f6b900; margin: 0;">
                    {int(total_time // 3600)}h {int((total_time % 3600) // 60)}m
                </p>
            </div>
        """, unsafe_allow_html=True)
    
    with col_timer2:
        # Timer
        if 'timer_running' not in st.session_state:
            st.session_state.timer_running = False
        
        if not st.session_state.timer_running:
            col_btn4, col_spacer4 = st.columns([1, 5])
            with col_btn4:
                if st.button("▶️ Start Timer", use_container_width=True):
                    st.session_state.timer_running = True
                    st.session_state.timer_start = time.time()
                    st.rerun()
        else:
            elapsed = int(time.time() - st.session_state.timer_start)
            st.markdown(f"""
                <div class="timer-display">
                    {elapsed // 3600:02d}:{(elapsed % 3600) // 60:02d}:{elapsed % 60:02d}
                </div>
            """, unsafe_allow_html=True)
            
            col_btn5, col_spacer5 = st.columns([1, 5])
            with col_btn5:
                if st.button("⏹️ Stop & Log", use_container_width=True):
                    duration = int(time.time() - st.session_state.timer_start)
                    db.log_time_entry(task_id, st.session_state.user_email, duration)
                    st.session_state.timer_running = False
                    st.success(f"Logged {duration // 60} minutes!")
                    st.rerun()
    
    # Manual time entry
    with st.expander("➕ Manually Log Time"):
        with st.form("manual_time"):
            hours = st.number_input("Hours", min_value=0, max_value=24, value=0)
            minutes = st.number_input("Minutes", min_value=0, max_value=59, value=0)
            description = st.text_input("Description (optional)")
            col_btn6, col_spacer6 = st.columns([1, 5])
            with col_btn6:
                if st.form_submit_button("Log Time"):
                    total_seconds = (hours * 3600) + (minutes * 60)
                    if total_seconds > 0:
                        db.log_time_entry(task_id, st.session_state.user_email, total_seconds, description)
                        st.success("Time logged!")
                        st.rerun()
    
    # Time entries log
    if time_entries:
        st.markdown("#### Time Log")
        for entry in time_entries[:10]:
            duration_str = f"{entry['duration'] // 3600}h {(entry['duration'] % 3600) // 60}m"
            st.markdown(f"""
                <div style="background: #411c30; padding: 8px; border-radius: 4px; margin-bottom: 4px;">
                    <strong>{duration_str}</strong> • {entry['user']} • 
                    <span style="color: rgba(255, 255, 255, 0.7); font-size: 12px;">
                        {entry['timestamp'].strftime('%b %d, %I:%M %p')}
                    </span>
                </div>
            """, unsafe_allow_html=True)

with col2:
    # Task Actions
    st.markdown("### 🎯 Quick Actions")
    
    # Status change
    current_status = task['status']
    new_status = st.selectbox("Change Status", ["To Do", "In Progress", "Completed"], 
                              index=["To Do", "In Progress", "Completed"].index(current_status))
    
    if new_status != current_status:
        col_btn7, col_spacer7 = st.columns([1, 5])
        with col_btn7:
            if st.button("Update Status", use_container_width=True):
                db.update_task_status(task_id, new_status)
                st.success(f"Status updated to {new_status}!")
                st.rerun()
    
    # Deadline Extension Request
    if task['assignee'] == st.session_state.user_email and current_status != "Completed":
        st.markdown("---")
        st.markdown("### 📅 Request Extension")
        with st.form("extension_request"):
            new_deadline = st.date_input("New Deadline", 
                                        value=task['due_date'].date(),
                                        min_value=datetime.date.today())
            reason = st.text_area("Reason for Extension")
            col_btn8, col_spacer8 = st.columns([1, 5])
            with col_btn8:
                if st.form_submit_button("Submit Request"):
                    new_deadline_dt = datetime.datetime.combine(new_deadline, datetime.time.min)
                    db.create_extension_request(task_id, st.session_state.user_email, new_deadline_dt, reason)
                    st.success("Extension request submitted!")
                    st.rerun()
    
    st.markdown("---")
    
    # Task Details
    st.markdown("### 📊 Task Details")
    st.markdown(f"""
        <div class="custom-card">
            <p style="margin: 5px 0;"><strong>Assignee:</strong> {task['assignee']}</p>
            <p style="margin: 5px 0;"><strong>Created:</strong> {task['created_at'].strftime('%B %d, %Y')}</p>
            <p style="margin: 5px 0;"><strong>Last Updated:</strong> {task.get('updated_at', task['created_at']).strftime('%B %d, %Y')}</p>
            <p style="margin: 5px 0;"><strong>Completion:</strong> {task['completion_pct']}%</p>
        </div>
    """, unsafe_allow_html=True)
    
    # Recurring Task Info
    if task.get('is_recurring'):
        st.markdown("---")
        st.markdown("### 🔄 Recurring Task")
        pattern = task.get('recurrence_pattern', {})
        st.info(f"This task repeats {pattern.get('type', 'regularly')}")
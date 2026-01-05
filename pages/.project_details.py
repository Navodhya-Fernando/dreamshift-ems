import streamlit as st
from src.database import DreamShiftDB
import datetime
import html

st.set_page_config(page_title="Project Details", page_icon="📁", layout="wide")

# Load custom CSS
with open('static/styles.css') as f:
    st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)

db = DreamShiftDB()

# Ensure user is logged in
if "user_email" not in st.session_state:
    st.error("Please login on the Home page first.")
    st.stop()

# Ensure project is selected
if "selected_project_id" not in st.session_state:
    st.error("No project selected. Please select a project from the Projects page.")
    if st.button("← Go to Projects"):
        st.switch_page("pages/2_projects.py")
    st.stop()

user_email = st.session_state.user_email
project_id = st.session_state.selected_project_id

# Get project details
project = db.get_project(project_id)

if not project:
    st.error("Project not found.")
    if st.button("← Back to Projects"):
        st.switch_page("pages/2_projects.py")
    st.stop()

# Back button
if st.button("← Back to Projects"):
    st.switch_page("pages/2_projects.py")

# Project header
st.markdown(f"""
    <h1 style="color: #f6b900;">📁 {html.escape(project['name'])}</h1>
    <p style="color: rgba(255, 255, 255, 0.7); margin-bottom: 30px;">{html.escape(project.get('description', 'No description'))}</p>
""", unsafe_allow_html=True)

# Get project statistics
stats = db.get_project_stats(project_id)

# Statistics overview
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">📋 TOTAL TASKS</div>
            <div class="metric-value">{stats['total_tasks']}</div>
        </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">✅ COMPLETED</div>
            <div class="metric-value">{stats['completed_tasks']}</div>
        </div>
    """, unsafe_allow_html=True)

with col3:
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">🔄 IN PROGRESS</div>
            <div class="metric-value">{stats['in_progress_tasks']}</div>
        </div>
    """, unsafe_allow_html=True)

with col4:
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">📊 COMPLETION</div>
            <div class="metric-value">{stats['completion_percentage']}%</div>
        </div>
    """, unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# Project information card
st.markdown(f"""
    <div class="custom-card">
        <h3 style="color: #f6b900;">Project Information</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 15px;">
            <div>
                <p style="color: rgba(255, 255, 255, 0.7); margin: 0; font-size: 12px;">SERVICE</p>
                <p style="color: #ffffff; margin: 5px 0 0 0; font-weight: 600;">📦 {html.escape(project.get('service', 'N/A'))}</p>
            </div>
            <div>
                <p style="color: rgba(255, 255, 255, 0.7); margin: 0; font-size: 12px;">DEADLINE</p>
                <p style="color: #ffffff; margin: 5px 0 0 0; font-weight: 600;">📅 {project['deadline'].strftime('%B %d, %Y')}</p>
            </div>
            <div>
                <p style="color: rgba(255, 255, 255, 0.7); margin: 0; font-size: 12px;">STATUS</p>
                <p style="color: #f6b900; margin: 5px 0 0 0; font-weight: 600;">📍 {project.get('status', 'Active')}</p>
            </div>
        </div>
    </div>
""", unsafe_allow_html=True)

st.markdown("---")

# Tasks section
st.markdown("### 📋 Project Tasks")

tasks = db.get_tasks_for_project(project_id)

if not tasks:
    st.info("No tasks created for this project yet.")
else:
    # Group tasks by status
    task_groups = {
        "To Do": [],
        "In Progress": [],
        "In Review": [],
        "Completed": []
    }
    
    for task in tasks:
        status = task.get('status', 'To Do')
        if status in task_groups:
            task_groups[status].append(task)
    
    # Display tasks by status
    for status, task_list in task_groups.items():
        if task_list:
            st.markdown(f"#### {status} ({len(task_list)})")
            
            for task in task_list:
                # Color coding for priority
                priority_colors = {
                    'Urgent': '#ff4444',
                    'High': '#ff8800',
                    'Normal': '#f6b900',
                    'Low': '#888888'
                }
                priority_color = priority_colors.get(task.get('priority', 'Normal'), '#f6b900')
                
                # Status badge color
                status_colors = {
                    'To Do': '#888888',
                    'In Progress': '#f6b900',
                    'In Review': '#00aaff',
                    'Completed': '#00ff88'
                }
                status_color = status_colors.get(status, '#888888')
                
                task_title = html.escape(task.get('title', 'Untitled'))
                task_desc = html.escape(task.get('desc', 'No description'))
                assignee = html.escape(task.get('assignee', 'Unassigned'))
                
                st.markdown(f"""
<div class="custom-card">
<div style="display:flex; justify-content:space-between; align-items:start;">
<div style="flex:1;">
<h4 style="margin:0; color:#f6b900;">{task_title}</h4>
<p style="margin:5px 0; color:rgba(255,255,255,0.7); font-size:14px;">{task_desc}</p>
<div style="display:flex; gap:15px; margin-top:10px; font-size:13px;">
<span style="color:rgba(255,255,255,0.7);">👤 {assignee}</span>
<span style="color:rgba(255,255,255,0.7);">�� Due: {task['due_date'].strftime('%b %d, %Y')}</span>
<span style="color:{priority_color}; font-weight:600;">🔔 {task.get('priority', 'Normal')}</span>
</div>
</div>
<div>
<span style="background:{status_color}; color:#000; padding:6px 12px; border-radius:6px; font-weight:600; font-size:12px;">{status}</span>
</div>
</div>
</div>
                """, unsafe_allow_html=True)
                
                if st.button(f"View Task Details", key=f"view_task_{task['_id']}", use_container_width=True):
                    st.session_state.selected_task_id = str(task['_id'])
                    st.switch_page("pages/.task_details.py")

# Footer
st.markdown("---")
st.markdown("""
    <div style="text-align: center; color: rgba(255, 255, 255, 0.7);">
        <p>💡 Tip: Click on any task to view detailed information and update status</p>
    </div>
""", unsafe_allow_html=True)

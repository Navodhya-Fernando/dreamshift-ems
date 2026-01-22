import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.mailer import send_email
import time
import secrets
import hashlib
import html

# Page config
st.set_page_config(
  page_title="Home - DreamShift EMS",
  page_icon="static/icons/home.svg",
  layout="wide",
  initial_sidebar_state="expanded"
)

# Import UI utilities
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

# Hide default sidebar navigation and show custom sidebar
hide_streamlit_sidebar()
render_custom_sidebar()

# Load global CSS
load_global_css()

db = DreamShiftDB()


def logout():
  """Clear session state, revoke token, and return to sign-in."""
  token = st.session_state.get("session_token")
  if token:
    try:
      db.delete_session_token(token)
    except Exception:
      pass
  for key in [
    "user_email",
    "user_name",
    "session_token",
    "current_ws_id",
    "current_ws_name",
    "user_role",
  ]:
    st.session_state.pop(key, None)
  st.query_params.clear()
  st.switch_page("pages/0_🚪_Sign_In.py")

# Auto-reauth using session token in URL
if "user_email" not in st.session_state:
  token = st.query_params.get("session_token")
  if token:
    user = db.get_session_by_token(token)
    if user:
      st.session_state.user_email = user["email"]
      st.session_state.user_name = user.get("name", user["email"].split("@")[0])
      st.session_state.session_token = token
    else:
      # invalid token, clear it
      st.query_params.clear()
      st.switch_page("pages/0_🚪_Sign_In.py")
  else:
    st.switch_page("pages/0_🚪_Sign_In.py")



# Initialize session state for workspace if not already set
if "current_ws_name" not in st.session_state:
    workspaces = db.get_user_workspaces(st.session_state.user_email)
    if workspaces:
        st.session_state.current_ws_id = str(workspaces[0]['_id'])
        st.session_state.current_ws_name = workspaces[0]['name']
        role = db.get_user_role(st.session_state.current_ws_id, st.session_state.user_email)
        st.session_state.user_role = role if role else "Member"

# ==========================================
# MAIN DASHBOARD
# ==========================================

# Header with Greeting + local time (12-hour, AM/PM fixed)
now = datetime.datetime.now()
hour = now.hour
if hour < 12:
    greeting = "Good Morning"
elif hour < 18:
    greeting = "Good Afternoon"
else:
    greeting = "Good Evening"

time_str = now.strftime("%I:%M %p").lstrip("0")

# Use Custom SVG for Home Icon
home_icon_html = get_svg("home.svg", width=38, height=38) or ":material/home:"

st.markdown(f"""
<div class="ds-hero">
  <div>
    <h1 style="display:flex; align-items:center; gap:12px;">
        {home_icon_html} {greeting}, {html.escape(st.session_state.get('user_name', 'User'))}
    </h1>
    <p style="opacity:0.7; margin-left: 4px;">Local time: {time_str}</p>
  </div>
</div>
""", unsafe_allow_html=True)

# Key Metrics
stats = db.get_user_stats(st.session_state.user_email)

st.markdown(f"""
<div class="ds-metrics">
  <div class="ds-metric">
    <div class="ds-metric-label">Total Tasks</div>
    <div class="ds-metric-value">{stats['assigned']}</div>
  </div>
  <div class="ds-metric">
    <div class="ds-metric-label">Completed</div>
    <div class="ds-metric-value">{stats['completed']}</div>
  </div>
  <div class="ds-metric">
    <div class="ds-metric-label">Completion Rate</div>
    <div class="ds-metric-value">{stats['rate']}%</div>
  </div>
  <div class="ds-metric">
    <div class="ds-metric-label">This Week</div>
    <div class="ds-metric-value">{stats['week_hours']}h</div>
  </div>
</div>
""", unsafe_allow_html=True)

st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)

# Main Content Area
tab1, tab2, tab3 = st.tabs([
  ":material/list_alt: My Tasks",
  ":material/warning: Urgent",
  ":material/history: Activity",
])

with tab1:
    st.markdown("### My Active Tasks")
    
    # Get tasks FIRST before rendering filters
    query = {"assignee": st.session_state.user_email}
    tasks = db.get_tasks_with_urgency(query)
    
    # Only show filters if there are tasks
    if tasks:
        st.markdown('<div class="ds-filters">', unsafe_allow_html=True)
        
        filter_col1, filter_col2, filter_col3 = st.columns([2, 1, 1])
        with filter_col1:
            search = st.text_input("", placeholder="🔍 Search tasks...", label_visibility="collapsed")
        with filter_col2:
            status_filter = st.selectbox("", ["All", "To Do", "In Progress", "Completed"], label_visibility="collapsed")
        with filter_col3:
            sort_by = st.selectbox("", ["Due Date", "Priority", "Created"], label_visibility="collapsed")
        
        st.markdown('</div>', unsafe_allow_html=True)
        
        # Apply filters
        if status_filter != "All":
            tasks = [t for t in tasks if t.get('status') == status_filter]
        
        # Apply search filter
        if search:
            tasks = [t for t in tasks if search.lower() in t['title'].lower() or search.lower() in t.get('description', '').lower()]
        
        # Render tasks
        if not tasks:
            st.info("🎉 No tasks match your filters. Great work!")
        else:
            for task in tasks:
                if task['urgency_color'] == "#DC3545":
                    urgency_cls = "urgent"
                elif task['urgency_color'] == "#FFC107":
                    urgency_cls = "warn"
                else:
                    urgency_cls = "ok"

                title = html.escape(task['title'])
                project = html.escape(task.get('project_name', 'No Project'))
                priority = html.escape(task.get('priority', 'N/A'))
                status = html.escape(task.get('status', 'To Do'))
                due = task['due_date'].strftime('%B %d, %Y') if task.get('due_date') else "No due date"
                pct = int(task.get('completion_pct', 0))

                st.markdown(f"""
                <div class="ds-task {urgency_cls}">
                  <div class="ds-task-top">
                    <div style="flex:1;">
                      <p class="ds-task-title">{title}</p>
                      <div class="ds-badges">
                        <span class="ds-badge">{project}</span>
                        <span class="ds-badge ds-badge-accent">{status}</span>
                        <span class="ds-badge">{priority}</span>
                      </div>
                      <div class="ds-task-sub">Due: {due} • Progress: {pct}%</div>
                      <div class="ds-progress"><div style="width:{pct}%;"></div></div>
                    </div>
                  </div>
                </div>
                """, unsafe_allow_html=True)

                # Only create action columns if there are actions to show
                actions_available = True
                action_cols = st.columns([1, 1, 1, 1])
                
                with action_cols[0]:
                    if st.button("View Details", key=f"view_{task['_id']}", use_container_width=True):
                        st.session_state.selected_task_id = str(task['_id'])
                        st.switch_page("pages/task_details.py")
                
                with action_cols[1]:
                    if status != "Completed":
                        if st.button("Mark Complete", key=f"complete_{task['_id']}", use_container_width=True):
                            db.update_task_status(str(task['_id']), "Completed")
                            st.rerun()
                
                with action_cols[2]:
                    if status == "To Do":
                        if st.button("Start", key=f"start_{task['_id']}", use_container_width=True):
                            db.update_task_status(str(task['_id']), "In Progress")
                            st.rerun()
                
                with action_cols[3]:
                    st.markdown('<div class="ds-secondary">', unsafe_allow_html=True)
                    st.button("Track Time", key=f"time_{task['_id']}", use_container_width=True)
                    st.markdown('</div>', unsafe_allow_html=True)
    else:
        st.info("🎉 No tasks found. You're all caught up!")

with tab2:
    st.markdown("### 🔥 Urgent & Overdue Tasks")
    
    urgent_tasks = [t for t in db.get_tasks_with_urgency({"assignee": st.session_state.user_email, "status": {"$ne": "Completed"}}) 
                    if t['urgency_color'] == "#DC3545" or t.get('due_date', datetime.datetime.max) < datetime.datetime.utcnow()]
    
    if not urgent_tasks:
      st.success(":material/check_circle: Great! No urgent tasks at the moment.")
    else:
        st.warning(f":material/warning: You have {len(urgent_tasks)} urgent/overdue tasks!")
        
        for task in urgent_tasks:
            is_overdue = task.get('due_date', datetime.datetime.max) < datetime.datetime.utcnow()
            title = html.escape(task['title'])
            project = html.escape(task.get('project_name', 'No Project'))
            due = task['due_date'].strftime('%B %d, %Y') if task.get('due_date') else "No due date"
            
            st.markdown(f"""
              <div class="ds-task urgent">
                <p class="ds-task-title">{' :material/priority_high: OVERDUE' if is_overdue else ' :material/bolt: URGENT'}: {title}</p>
                <div class="ds-task-sub">Due: {due} | Project: {project}</div>
              </div>
            """, unsafe_allow_html=True)
            
            if st.button("View & Take Action", key=f"urgent_{task['_id']}", use_container_width=True):
                st.session_state.selected_task_id = str(task['_id'])
                st.switch_page("pages/task_details.py")

with tab3:
    st.markdown("### :material/history: Recent Activity")
    
    # Get recent updates from tasks
    all_tasks = db.get_tasks_with_urgency({"assignee": st.session_state.user_email})
    recent_tasks = sorted(all_tasks, key=lambda x: x.get('updated_at', x['created_at']), reverse=True)[:10]
    
    for task in recent_tasks:
        status_icon = ":material/check_circle:" if task['status'] == "Completed" else ":material/schedule:" if task['status'] == "In Progress" else ":material/notes:"
        title = html.escape(task['title'])
        status = html.escape(task['status'])
        project = html.escape(task.get('project_name', 'No Project'))
        timestamp = task.get('updated_at', task['created_at']).strftime('%b %d, %I:%M %p')
        
        st.markdown(f"""
            <div class="ds-task">
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight:850;">{status_icon} {title}</span>
                    <span style="color: var(--muted); font-size: 12px;">{timestamp}</span>
                </div>
                <p style="margin: 4px 0 0 0; color: var(--muted); font-size: 13px;">
                    Status: {status} • {project}
                </p>
            </div>
        """, unsafe_allow_html=True)

# Footer
st.markdown("---")
st.markdown("""
    <div style="text-align: center; color: rgba(255, 255, 255, 0.7); padding: 20px;">
        <p style="margin: 0;">DreamShift EMS © 2026 • Made for better productivity</p>
    </div>
""", unsafe_allow_html=True)
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
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

# Hide default sidebar navigation and show custom sidebar
hide_streamlit_sidebar()
render_custom_sidebar()

# Load global CSS
load_global_css()

# Base CSS - Applied to ALL pages
st.markdown("""
<style>
:root{
  --bg:#24101a;
  --panel:#411c30;
  --panel2:rgba(255,255,255,0.06);
  --border:rgba(255,255,255,0.10);
  --muted:rgba(255,255,255,0.70);
  --text:#ffffff;
  --accent:#f6b900;
  --accent2:#ffc933;
  --danger:#ff4d4d;
  --warn:#ffb020;
  --ok:#2fe37a;
}

.stApp{ background:var(--bg)!important; }

/* Wide dashboard layout */
.block-container{
  max-width: 100% !important;
  padding: 1.8rem 2.5rem !important;
}

/* Typography */
h1,h2,h3,h4{ letter-spacing:-0.2px; color:var(--text); }
.stMarkdown p,
.stMarkdown span,
.stMarkdown div{
  color: var(--text) !important;
}

/* Hide heading anchor icons/dashes added by Streamlit */
[data-testid="stMarkdownContainer"] h1 a,
[data-testid="stMarkdownContainer"] h2 a,
[data-testid="stMarkdownContainer"] h3 a,
[data-testid="stMarkdownContainer"] h4 a,
[data-testid="stMarkdownContainer"] h5 a,
[data-testid="stMarkdownContainer"] h6 a {
  display: none !important;
}

/* Inputs */
.stTextInput input, .stTextArea textarea, .stSelectbox div[data-baseweb="select"] > div{
  background: var(--panel2) !important;
  border: 1px solid var(--border) !important;
  border-radius: 12px !important;
  color: var(--text) !important;
}
.stTextInput input:focus, .stTextArea textarea:focus{
  border-color: rgba(246,185,0,0.55) !important;
  box-shadow: 0 0 0 2px rgba(246,185,0,0.18) !important;
}

/* Buttons */
.stButton button, .stFormSubmitButton button{
  background: var(--accent) !important;
  color: #411c30 !important;
  border: 0 !important;
  border-radius: 12px !important;
  padding: 0.72rem 1rem !important;
  font-weight: 850 !important;
  box-shadow:none !important;
  transition: all 0.18s ease !important;
}
.stButton button:hover, .stFormSubmitButton button:hover{
  background: #ffe500 !important;
  color: #411c30 !important;
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(255,229,0,0.35) !important;
}

/* Secondary button wrapper */
.ds-secondary .stButton button, .ds-secondary .stFormSubmitButton button{
  background: transparent !important;
  color: rgba(255,255,255,0.85) !important;
  border: 1px solid var(--border) !important;
}
.ds-secondary .stButton button:hover, .ds-secondary .stFormSubmitButton button:hover{
  background: rgba(255,255,255,0.06) !important;
  color: rgba(255,255,255,0.95) !important;
  border-color: rgba(255,255,255,0.16) !important;
  transform:none !important;
  box-shadow: none !important;
}

/* Tabs (Streamlit tabs) */
.stTabs [data-baseweb="tab-list"]{
  gap: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.stTabs [data-baseweb="tab"]{
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  padding: 10px 14px;
  color: rgba(255,255,255,0.85);
}
.stTabs [aria-selected="true"]{
  background: rgba(255,255,255,0.10) !important;
  border-color: rgba(255,255,255,0.18) !important;
  color: #fff !important;
}

/* ---------- Reusable components ---------- */
.ds-card{
  background: var(--panel);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 18px;
  padding: 18px;
  box-shadow: 0 18px 55px rgba(0,0,0,0.45);
  margin-bottom: 14px;
}

.ds-hero{
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  gap: 14px;
  margin: 6px 0 14px;
}
.ds-hero h1{
  margin:0;
  font-size: 1.9rem;
  font-weight: 900;
}
.ds-hero p{
  margin:6px 0 0;
  color: var(--muted);
}

.ds-metrics{
  display:grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 12px;
  margin: 10px 0 6px;
}
.ds-metric{
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 16px;
  padding: 14px;
}
.ds-metric-label{
  color: var(--muted);
  font-size: 0.76rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.ds-metric-value{
  color: var(--text);
  font-size: 1.55rem;
  font-weight: 900;
  margin-top: 6px;
}

.ds-task{
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
}
.ds-task.urgent{ border-left: 4px solid var(--danger); }
.ds-task.warn{ border-left: 4px solid var(--warn); }
.ds-task.ok{ border-left: 4px solid var(--ok); }

.ds-task-top{
  display:flex;
  justify-content:space-between;
  gap: 12px;
}
.ds-task-title{
  margin:0;
  font-weight: 850;
  font-size: 1.02rem;
}
.ds-task-sub{
  margin-top: 8px;
  color: var(--muted);
  font-size: 0.92rem;
}

.ds-badges{
  display:flex;
  gap: 8px;
  flex-wrap:wrap;
  margin-top: 10px;
}
.ds-badge{
  display:inline-flex;
  align-items:center;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 0.78rem;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.92);
}
.ds-badge-accent{
  border-color: rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.06);
  color: #fff;
}

.ds-progress{
  height: 8px;
  background: rgba(255,255,255,0.06);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
  margin-top: 10px;
}
.ds-progress > div{
  height: 100%;
  background: var(--accent);
  width: 0%;
}

/* Sidebar */
section[data-testid="stSidebar"]{
  background: var(--bg) !important;
  border-right: 1px solid rgba(255,255,255,0.08);
}
[data-testid="stSidebar"] .block-container{
  padding: 14px 14px 18px !important;
}
.ds-sb-card{
  background: var(--panel);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 12px;
}
.ds-pill{
  display:inline-flex;
  align-items:center;
  padding: 5px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.75);
}
.ds-pill-accent{
  border-color: rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.95);
}
.ds-avatar{
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgba(246,185,0,0.16);
  border: 1px solid rgba(246,185,0,0.28);
  display:flex;
  align-items:center;
  justify-content:center;
  color: rgba(246,185,0,0.95);
  font-weight: 900;
}
.ds-sb-title{ margin:0; font-weight:850; }
.ds-sb-sub{ margin:2px 0 0; color: var(--muted); font-size:0.82rem; }
.ds-sb-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap: 10px;
}

.ds-sb-nav .stButton button{
  width: 100% !important;
  background: rgba(255,255,255,0.04) !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
  color: rgba(255,255,255,0.92) !important;
  box-shadow:none !important;
  font-weight: 800 !important;
  border-radius: 12px !important;
  padding: 0.62rem 0.9rem !important;
}
.ds-sb-nav .stButton button:hover{
  background: rgba(255,255,255,0.06) !important;
  border-color: rgba(255,255,255,0.16) !important;
  transform:none !important;
}
.ds-sb-danger .stButton button{
  background: rgba(255,77,77,0.10) !important;
  border: 1px solid rgba(255,77,77,0.22) !important;
  color: rgba(255,220,220,0.95) !important;
}
.ds-sb-danger .stButton button:hover{
  background: rgba(255,77,77,0.14) !important;
  border-color: rgba(255,77,77,0.30) !important;
  color: #fff !important;
  transform:none !important;
}

[data-testid="stExpander"]{
  border: 1px solid rgba(255,255,255,0.10) !important;
  border-radius: 14px !important;
  background: rgba(255,255,255,0.03) !important;
}

@media (max-width: 900px){
  .ds-metrics{ grid-template-columns: repeat(2, minmax(0,1fr)); }
  .block-container{ padding: 1.2rem 1.2rem !important; }
}

/* FINAL OVERRIDE - Force all accent buttons to dark text */
button[kind="primary"],
button[kind="secondary"],
.stButton button,
.stFormSubmitButton button {
  color: #411c30 !important;
}
button[kind="primary"]:hover,
button[kind="secondary"]:hover,
.stButton button:hover,
.stFormSubmitButton button:hover {
  color: #411c30 !important;
}

/* FINAL FINAL OVERRIDE - force button text + all children to dark */
.stButton button,
.stFormSubmitButton button,
button[kind="primary"],
button[kind="secondary"],
button[data-testid^="stBaseButton-"]{
  color: #411c30 !important;
}

.stButton button *,
.stFormSubmitButton button *,
button[kind="primary"] *,
button[kind="secondary"] *,
button[data-testid^="stBaseButton-"] *{
  color: #411c30 !important;
}

/* ===== Sidebar: make buttons look like a menu (NOT yellow) ===== */
section[data-testid="stSidebar"] .stButton > button,
section[data-testid="stSidebar"] .stFormSubmitButton > button {
  width: 100% !important;
  background: rgba(255,255,255,0.04) !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
  color: rgba(255,255,255,0.92) !important;
  box-shadow: none !important;
  border-radius: 12px !important;
  padding: 0.62rem 0.9rem !important;
  font-weight: 800 !important;
  transform: none !important;
}

section[data-testid="stSidebar"] .stButton > button:hover,
section[data-testid="stSidebar"] .stFormSubmitButton > button:hover {
  background: rgba(255,255,255,0.06) !important;
  border-color: rgba(255,255,255,0.16) !important;
  color: rgba(255,255,255,0.95) !important;
  box-shadow: none !important;
  transform: none !important;
}

/* Sidebar button text (Streamlit sometimes wraps text in spans) */
section[data-testid="stSidebar"] .stButton > button *,
section[data-testid="stSidebar"] .stFormSubmitButton > button * {
  color: rgba(255,255,255,0.92) !important;
}

section[data-testid="stSidebar"] .stButton > button:hover *,
section[data-testid="stSidebar"] .stFormSubmitButton > button:hover * {
  color: rgba(255,255,255,0.95) !important;
}

/* ===== Sidebar: Logout button styling (last button in sidebar) ===== */
section[data-testid="stSidebar"] .stButton:last-of-type > button {
  background: rgba(255,77,77,0.12) !important;
  border: 1px solid rgba(255,77,77,0.26) !important;
  color: rgba(255,220,220,0.98) !important;
}

section[data-testid="stSidebar"] .stButton:last-of-type > button:hover {
  background: rgba(255,77,77,0.18) !important;
  border-color: rgba(255,77,77,0.34) !important;
  color: #fff !important;
}

section[data-testid="stSidebar"] .stButton:last-of-type > button *,
section[data-testid="stSidebar"] .stButton:last-of-type > button:hover * {
  color: inherit !important;
}

/* ===== Align filter row inputs (same height + same top spacing) ===== */
.ds-filters [data-testid="stTextInput"] input,
.ds-filters [data-testid="stSelectbox"] div[data-baseweb="select"] > div{
  height: 44px !important;
  min-height: 44px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  display: flex !important;
  align-items: center !important;
  border-radius: 12px !important;
}

/* Remove tiny extra spacing Streamlit adds above widgets sometimes */
.ds-filters [data-testid="stWidgetLabel"]{ 
  display: none !important;
}
.ds-filters .stTextInput,
.ds-filters .stSelectbox{
  margin-top: 0 !important;
}
</style>
""", unsafe_allow_html=True)

db = DreamShiftDB()

"""
Auth is now handled in a dedicated login page. Home checks for a valid session or redirects.
"""


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
    emoji = "🌅"
elif hour < 18:
    greeting = "Good Afternoon"
    emoji = "☀️"
else:
    greeting = "Good Evening"
    emoji = "🌙"

time_str = now.strftime("%I:%M %p").lstrip("0")

st.markdown(f"""
<div class="ds-hero">
  <div>
    <h1>{emoji} {greeting}, {html.escape(st.session_state.get('user_name', st.session_state.user_email.split('@')[0]))}</h1>
    <p>Local time: {time_str}</p>
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
tab1, tab2, tab3 = st.tabs(["📝 My Tasks", "🔥 Urgent", "📊 Activity"])

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
        st.success("✨ Great! No urgent tasks at the moment.")
    else:
        st.warning(f"⚠️ You have {len(urgent_tasks)} urgent/overdue tasks!")
        
        for task in urgent_tasks:
            is_overdue = task.get('due_date', datetime.datetime.max) < datetime.datetime.utcnow()
            title = html.escape(task['title'])
            project = html.escape(task.get('project_name', 'No Project'))
            due = task['due_date'].strftime('%B %d, %Y') if task.get('due_date') else "No due date"
            
            st.markdown(f"""
                <div class="ds-task urgent">
                    <p class="ds-task-title">{'🚨 OVERDUE' if is_overdue else '⚡ URGENT'}: {title}</p>
                    <div class="ds-task-sub">Due: {due} | Project: {project}</div>
                </div>
            """, unsafe_allow_html=True)
            
            if st.button("View & Take Action", key=f"urgent_{task['_id']}", use_container_width=True):
                st.session_state.selected_task_id = str(task['_id'])
                st.switch_page("pages/task_details.py")

with tab3:
    st.markdown("### 📊 Recent Activity")
    
    # Get recent updates from tasks
    all_tasks = db.get_tasks_with_urgency({"assignee": st.session_state.user_email})
    recent_tasks = sorted(all_tasks, key=lambda x: x.get('updated_at', x['created_at']), reverse=True)[:10]
    
    for task in recent_tasks:
        status_emoji = "✅" if task['status'] == "Completed" else "⏳" if task['status'] == "In Progress" else "📝"
        title = html.escape(task['title'])
        status = html.escape(task['status'])
        project = html.escape(task.get('project_name', 'No Project'))
        timestamp = task.get('updated_at', task['created_at']).strftime('%b %d, %I:%M %p')
        
        st.markdown(f"""
            <div class="ds-task">
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight:850;">{status_emoji} {title}</span>
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
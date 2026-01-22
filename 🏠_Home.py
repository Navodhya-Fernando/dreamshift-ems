import streamlit as st
import datetime
import html
from src.database import DreamShiftDB

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

# --- Auth Check ---
if "user_email" not in st.session_state:
    st.switch_page("pages/0_🚪_Sign_In.py")

# Auto-Init Workspace if missing
if "current_ws_name" not in st.session_state:
    workspaces = db.get_user_workspaces(st.session_state.user_email)
    if workspaces:
        st.session_state.current_ws_id = str(workspaces[0]['_id'])
        st.session_state.current_ws_name = workspaces[0]['name']
        role = db.get_user_role(st.session_state.current_ws_id, st.session_state.user_email)
        st.session_state.user_role = role if role else "Member"

# --- HERO SECTION ---
now = datetime.datetime.now()
hour = now.hour
if hour < 12: greeting = "Good Morning"
elif hour < 18: greeting = "Good Afternoon"
else: greeting = "Good Evening"

# Use Custom SVG for Home Icon (Safe loader)
home_icon_html = get_svg("home.svg", width=38, height=38) or ":material/home:"

st.markdown(f"""
<div class="ds-hero">
  <div>
    <h1 style="display:flex; align-items:center; gap:12px;">
        {home_icon_html} {greeting}, {html.escape(st.session_state.get('user_name', 'User'))}
    </h1>
    <p style="opacity:0.7; margin-left: 4px;">Local time: {now.strftime("%I:%M %p").lstrip("0")}</p>
  </div>
</div>
""", unsafe_allow_html=True)

# --- KEY METRICS ---
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

st.markdown("<div style='height:20px;'></div>", unsafe_allow_html=True)

# --- TABS SECTION ---
tab1, tab2, tab3 = st.tabs([
  ":material/list_alt: My Tasks",
  ":material/warning: Urgent",
  ":material/history: Activity",
])

with tab1:
    st.markdown("### My Active Tasks")
    query = {"assignee": st.session_state.user_email}
    tasks = db.get_tasks_with_urgency(query)
    
    if tasks:
        # Professional Filter Bar
        st.markdown('<div class="ds-filters">', unsafe_allow_html=True)
        c1, c2, c3 = st.columns([2, 1, 1])
        with c1: search = st.text_input("Search", placeholder="🔍 Search...", label_visibility="collapsed")
        with c2: status_filter = st.selectbox("Status", ["All", "To Do", "In Progress", "Completed"], label_visibility="collapsed")
        with c3: sort_by = st.selectbox("Sort", ["Due Date", "Priority"], label_visibility="collapsed")
        st.markdown('</div>', unsafe_allow_html=True)
        
        # Filter Logic
        if status_filter != "All":
            tasks = [t for t in tasks if t.get('status') == status_filter]
        if search:
            tasks = [t for t in tasks if search.lower() in t['title'].lower()]
            
        # Render Task Cards
        if not tasks:
            st.info("No active tasks found.")
        else:
            for task in tasks:
                urgency_cls = "urgent" if task.get('urgency_color') == "#DC3545" else "ok"
                pct = int(task.get('completion_pct', 0))
                
                st.markdown(f"""
                <div class="ds-task {urgency_cls}">
                    <div class="ds-task-top">
                        <div style="flex:1">
                            <div class="ds-task-title">{html.escape(task['title'])}</div>
                            <div class="ds-badges" style="margin-top:6px;">
                                <span class="ds-badge">{html.escape(task.get('project_name', 'No Project'))}</span>
                                <span class="ds-badge ds-badge-accent">{html.escape(task.get('status', 'To Do'))}</span>
                                <span class="ds-badge">{html.escape(task.get('priority', 'Medium'))}</span>
                            </div>
                        </div>
                    </div>
                    <div class="ds-progress" style="margin-top:12px;"><div style="width:{pct}%;"></div></div>
                </div>
                """, unsafe_allow_html=True)
                
                # Action Buttons
                ac1, ac2 = st.columns([1, 5])
                with ac1:
                    if st.button("View Details", key=f"v_{task['_id']}", use_container_width=True):
                        st.session_state.selected_task_id = str(task['_id'])
                        st.switch_page("pages/task_details.py")
    else:
        st.info("No active tasks found. You're all caught up!", icon=":material/check_circle:")

with tab2:
    st.markdown("### 🔥 Urgent Tasks")
    urgent_tasks = [t for t in db.get_tasks_with_urgency({"assignee": st.session_state.user_email, "status": {"$ne": "Completed"}}) 
                    if t.get('urgency_color') == "#DC3545"]
    
    if not urgent_tasks:
        st.success("No urgent tasks!", icon=":material/check_circle:")
    else:
        for task in urgent_tasks:
            st.markdown(f"""
            <div class="ds-task urgent">
                <div class="ds-task-title">⚠️ {html.escape(task['title'])}</div>
                <div style="font-size:12px; opacity:0.7; margin-top:4px;">
                    Due: {task.get('due_date', 'Unknown')}
                </div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("Take Action", key=f"u_{task['_id']}", use_container_width=True):
                 st.session_state.selected_task_id = str(task['_id'])
                 st.switch_page("pages/task_details.py")

with tab3:
    st.markdown("### :material/history: Recent Activity")
    # Simple list for now
    st.caption("No recent activity.")
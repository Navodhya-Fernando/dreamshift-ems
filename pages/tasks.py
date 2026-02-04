import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Tasks", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

user_email = st.session_state.get("user_email")
if not user_email:
    st.warning("Please sign in to continue.")
    st.switch_page("pages/sign-in.py")

icon = get_svg("tasks.svg", 36, 36) or ":material/check_circle:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Tasks</h1></div>""", unsafe_allow_html=True)

ws_id = st.session_state.get("current_ws_id")
if not ws_id: 
    st.warning("Please select a workspace from the sidebar.")
    st.stop()

# --- FETCH MEMBERS FOR ASSIGNEE DROPDOWN ---
members = db.get_workspace_members(ws_id)
member_display = []
member_lookup = {}
for m in members:
    name = m.get("name") or m.get("email")
    email = m.get("email")
    if name and email:
        display = name
        # Handle duplicate names
        if display in member_lookup:
            display = f"{name} ({email})"
        member_display.append(display)
        member_lookup[display] = email

# Default assignee is current user
default_assignee_idx = 0
if user_email in member_lookup.values():
    current_user_name = next(name for name, email in member_lookup.items() if email == user_email)
    if current_user_name in member_display:
        default_assignee_idx = member_display.index(current_user_name)

# --- BETTER TASK CREATION FORM ---
with st.expander("Create New Task", expanded=False):
    with st.form("create_task_form"):
        c1, c2 = st.columns([2, 1])
        with c1:
            task_name = st.text_input("Task Name", placeholder="e.g. Fix Navigation Bar")
        with c2:
            priority = st.selectbox("Priority", ["Low", "Medium", "High", "Critical"], index=1)
            
        c3, c4, c5 = st.columns(3)
        with c3:
            assignee = st.selectbox("Assignee", member_display or ["Unassigned"], index=default_assignee_idx)
        with c4:
            start_date = st.date_input("Start Date", value=datetime.date.today())
        with c5:
            due_date = st.date_input("Due Date", value=datetime.date.today() + datetime.timedelta(days=1))
            
        if st.form_submit_button("Create Task", type="primary", use_container_width=True):
            if not task_name:
                st.error("Task Name is required.")
            else:
                assignee_email = member_lookup.get(assignee)
                db.create_task(
                    ws_id=ws_id,
                    title=task_name,
                    desc="", # Description is optional/empty initially
                    due_date=due_date,
                    assignee=assignee_email,
                    status="To Do",
                    priority=priority,
                    project_id=None,
                    creator=user_email,
                    start_date=start_date
                )
                st.success("Task created!")
                st.rerun()

# --- TASK LIST (Kanban/List Hybrid) ---
st.markdown("### Tasks Board")

statuses = db.get_workspace_statuses(ws_id)
status_filter_default = []
f1, f2 = st.columns([2, 1])
with f1:
    status_filter = st.multiselect("Filter by Status", statuses, default=status_filter_default)
with f2:
    priority_filter = st.multiselect("Filter by Priority", ["Low", "Medium", "High", "Critical"], default=[])

query = {"workspace_id": ws_id}
if status_filter:
    query["status"] = {"$in": status_filter}
if priority_filter:
    query["priority"] = {"$in": priority_filter}

tasks = db.get_tasks_with_urgency(query)

if not tasks:
    st.info("No active tasks in this workspace.")
else:
    # Group tasks by status
    status_order = [s for s in statuses if s in status_filter] if status_filter else statuses
    grouped = {s: [] for s in status_order}
    for t in tasks:
        s = t.get("status") or "To Do"
        if s in grouped:
            grouped[s].append(t)

    cols = st.columns(len(status_order) if status_order else 1)
    for idx, status in enumerate(status_order):
        with cols[idx]:
            status_key = status.lower().replace(' ', '-')
            st.markdown(f"<div class='ds-status ds-status--{status_key}' style='margin-bottom:10px;'>{status}</div>", unsafe_allow_html=True)
            if not grouped.get(status):
                st.caption("No tasks")
            for t in grouped.get(status, []):
                urgency_color = t.get('urgency_color', '#ccc')
                priority_key = (t.get('priority') or '').lower()
                assignee_name = next((k for k, v in member_lookup.items() if v == t.get('assignee')), 'Unassigned')

                with st.container():
                    st.markdown(f"""
                    <div class="ds-card" style="padding: 12px; margin-bottom: 10px;">
                        <div style="font-weight: 700; font-size: 1rem; margin-bottom: 6px; color: #f6b900;">{t['title']}</div>
                        <div class="ds-meta" style="flex-wrap:wrap;">
                            <span class="ds-meta-item">Assignee: {assignee_name}</span>
                            <span class="ds-meta-item" style="border-color:{urgency_color}; color:{urgency_color};">Due: {t.get('due_date').strftime('%b %d') if t.get('due_date') else 'No Date'}</span>
                            <span class="ds-priority--{priority_key} ds-status">Priority: {t.get('priority')}</span>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)

                    btn_col = st.columns([1])
                    with btn_col[0]:
                        if st.button("Open", key=f"open_{t['_id']}", help="Open Details", use_container_width=True):
                            st.session_state.selected_task_id = str(t['_id'])
                            st.switch_page("pages/task-details.py")
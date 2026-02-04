import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar
from src.chat_ui import render_chat_interface

st.set_page_config(page_title="Project Details", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

user_email = st.session_state.get("user_email")
if not user_email:
    st.warning("Please sign in to continue.")
    st.switch_page("pages/sign-in.py")

pid = st.session_state.get("selected_project_id")
if not pid:
    st.switch_page("pages/projects.py")

proj = db.db.projects.find_one({"_id": db.ObjectId(pid)})
if not proj:
    st.error("Project not found.")
    if st.button("Back to Projects"):
        st.switch_page("pages/projects.py")
    st.stop()

# --- HEADER ---
c1, c2 = st.columns([1, 6])
if c1.button("← Back"): st.switch_page("pages/projects.py")
c2.markdown(f"# <span style='color:#f6b900;'>{proj['name']}</span>", unsafe_allow_html=True)
if proj.get('description'):
    st.markdown(f"*{proj.get('description')}*")

meta_cols = st.columns(5)
deadline = proj.get('deadline')
start_date = proj.get('start_date')
ws_name = "—"
try:
    ws = db.db.workspaces.find_one({"_id": db.ObjectId(proj.get('workspace_id'))})
    if ws:
        ws_name = ws.get('name', ws_name)
except Exception:
    ws_name = ws_name

meta_cols[0].markdown(f"**Status**\n\n{proj.get('status', 'Active')}")
meta_cols[1].markdown(f"**Start Date**\n\n{start_date.strftime('%b %d, %Y') if start_date else '—'}")
meta_cols[2].markdown(f"**Deadline**\n\n{deadline.strftime('%b %d, %Y') if deadline else '—'}")
meta_cols[3].markdown(f"**Workspace**\n\n{ws_name}")
meta_cols[4].markdown(f"**Tasks**\n\n{db.db.tasks.count_documents({'project_id': pid})}")

st.divider()

# --- ADD TASK TO PROJECT ---
with st.expander("Add Task to Project"):
    with st.form("add_p_task"):
        c1, c2 = st.columns([2, 1])
        with c1:
            t_title = st.text_input("Task Title", placeholder="e.g. Finalize UI polish")
        with c2:
            t_priority = st.selectbox("Priority", ["Low", "Medium", "High", "Critical"], index=1)

        c3, c4, c5 = st.columns(3)
        with c3:
            members = db.get_workspace_members(proj['workspace_id'])
            member_display = []
            member_lookup = {}
            for m in members:
                name = m.get("name") or m.get("email")
                email = m.get("email")
                if name and email:
                    display = name
                    if display in member_lookup:
                        display = f"{name} ({email})"
                    member_display.append(display)
                    member_lookup[display] = email
            default_assignee = next((d for d, em in member_lookup.items() if em == user_email), None)
            t_assignee = st.selectbox("Assignee", member_display or ["Unassigned"], index=member_display.index(default_assignee) if default_assignee in member_display else 0)
        with c4:
            t_start = st.date_input("Start Date", value=datetime.date.today())
        with c5:
            t_due = st.date_input("Deadline", value=datetime.date.today() + datetime.timedelta(days=7))

        if st.form_submit_button("Add Task", type="primary", use_container_width=True):
            if not t_title:
                st.error("Task Title is required.")
            else:
                db.create_task(
                    proj['workspace_id'],
                    t_title,
                    "",
                    t_due,
                    member_lookup.get(t_assignee),
                    "To Do",
                    t_priority,
                    pid,
                    user_email,
                    start_date=t_start
                )
                st.rerun()

# --- PROJECT TASKS ---
tasks = db.get_tasks_with_urgency({"project_id": pid})
status_options = sorted({t.get("status", "To Do") for t in tasks})
priority_options = ["Low", "Medium", "High", "Critical"]

f1, f2 = st.columns([2, 1])
with f1:
    status_filter = st.multiselect("Filter by Status", status_options, default=status_options)
with f2:
    priority_filter = st.multiselect("Filter by Priority", priority_options, default=priority_options)

if status_filter:
    tasks = [t for t in tasks if t.get("status", "To Do") in status_filter]
if priority_filter:
    tasks = [t for t in tasks if t.get("priority", "Medium") in priority_filter]

if not tasks:
    st.info("No tasks in this project yet.")
else:
    for t in tasks:
        status_key = (t.get('status') or '').lower().replace(' ', '-')
        priority_key = (t.get('priority') or '').lower()
        col1, col2, col3 = st.columns([5, 2, 1])
        col1.markdown(f"<span style='color:#f6b900; font-weight:700;'>{t['title']}</span>", unsafe_allow_html=True)
        col2.markdown(
            f"<span class='ds-status ds-status--{status_key}'>{t.get('status')}</span> "
            f"<span class='ds-status ds-priority--{priority_key}'>Priority: {t.get('priority','Medium')}</span>",
            unsafe_allow_html=True
        )
        if col3.button("View", key=f"p_{t['_id']}"):
            st.session_state.selected_task_id = str(t['_id'])
            st.switch_page("pages/task-details.py")

# --- PROJECT DISCUSSION ---
render_chat_interface(pid, "project")
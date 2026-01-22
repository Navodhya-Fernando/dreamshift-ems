import streamlit as st
import datetime

from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg
from src.chat_ui import render_chat_interface

st.set_page_config(page_title="Project Details", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

db = DreamShiftDB()

# Auth guard
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

pid = st.session_state.get("selected_project_id")
if not pid:
    st.switch_page("pages/projects.py")

proj = db.db.projects.find_one({"_id": db.ObjectId(pid)})
if not proj:
    st.error("Project not found.")
    if st.button("Back to Projects", type="secondary"):
        st.switch_page("pages/projects.py")
    st.stop()

# -----------------------------
# Header (SVG only, no emojis)
# -----------------------------
icon = get_svg("projects.svg", 22, 22)
h1, h2 = st.columns([1, 9])

with h1:
    if st.button("Back", type="secondary", use_container_width=True):
        st.switch_page("pages/projects.py")

with h2:
    st.markdown(
        f"""
        <div class="ds-page-head" style="padding:0; border:none; margin:0;">
            <div class="ds-page-head-left">
                <div class="ds-page-icon">{icon}</div>
                <div class="ds-page-titles">
                    <div class="ds-page-title">{proj.get('name', 'Untitled Project')}</div>
                    <div class="ds-page-subtitle">{(proj.get('description') or 'No description yet.').strip()}</div>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

st.markdown("<div class='ds-divider'></div>", unsafe_allow_html=True)

# -----------------------------
# Layout: Tasks (left) / Discussion (right)
# -----------------------------
left, right = st.columns([2.1, 1.4])

# -----------------------------
# Left: Project tasks + Create task
# -----------------------------
with left:
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Tasks</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>Tasks linked to this project.</div>", unsafe_allow_html=True)

    # Create task in project (minimal)
    with st.expander("Add task", expanded=False):
        members = db.get_workspace_members(proj["workspace_id"]) or []
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

        default_display = None
        for disp, em in member_lookup.items():
            if em == st.session_state.user_email:
                default_display = disp
                break

        default_idx = member_display.index(default_display) if default_display in member_display else 0

        with st.form("add_p_task", clear_on_submit=True):
            r1c1, r1c2 = st.columns([2.2, 1.3])
            with r1c1:
                t_title = st.text_input("Task Name", placeholder="e.g., Create Project UI Form")
            with r1c2:
                priority = st.selectbox("Priority", ["Low", "Medium", "High", "Critical"], index=1)

            r2c1, r2c2 = st.columns([1.4, 1.2])
            with r2c1:
                assignee_disp = st.selectbox(
                    "Assignee",
                    member_display or ["Unassigned"],
                    index=default_idx if member_display else 0,
                )
            with r2c2:
                due_date = st.date_input(
                    "Due Date",
                    value=datetime.date.today() + datetime.timedelta(days=7),
                )

            a1, a2 = st.columns([1.2, 4.8])
            add = a1.form_submit_button("Add", type="primary", use_container_width=True)
            cancel = a2.form_submit_button("Cancel", type="secondary", use_container_width=True)

            if cancel:
                st.stop()

            if add:
                if not (t_title or "").strip():
                    st.error("Task Name is required.")
                else:
                    db.create_task(
                        ws_id=str(proj["workspace_id"]),
                        title=t_title.strip(),
                        desc="",
                        due_date=due_date,
                        assignee=member_lookup.get(assignee_disp),
                        status="To Do",
                        priority=priority,
                        project_id=pid,
                        creator=st.session_state.user_email,
                    )
                    st.success("Task added to project.")
                    st.rerun()

    # Task list (clean rows)
    tasks = db.get_tasks_with_urgency({"project_id": pid}) or []

    if not tasks:
        st.markdown("<div class='ds-empty-mini'>No tasks in this project yet.</div>", unsafe_allow_html=True)
    else:
        for t in tasks:
            urgency_color = t.get("urgency_color", "rgba(255,255,255,0.18)")
            title = t.get("title", "Untitled")
            status = t.get("status", "To Do")
            prio = t.get("priority", "Medium")

            due = t.get("due_date")
            due_str = due.strftime("%b %d") if due else "No date"

            st.markdown(
                f"""
                <div class="ds-task-row" style="border-left: 4px solid {urgency_color};">
                    <div class="ds-task-row-top">
                        <div class="ds-task-title">{title}</div>
                        <div class="ds-task-right">
                            <span class="ds-pill ds-pill-ghost">{status}</span>
                            <span class="ds-pill">{prio}</span>
                        </div>
                    </div>
                    <div class="ds-task-row-meta">
                        <div class="ds-task-meta-item">Due: {due_str}</div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            btn = st.columns([6, 1.2])
            with btn[1]:
                if st.button("Open", key=f"p_{t['_id']}", use_container_width=True, type="secondary"):
                    st.session_state.selected_task_id = str(t["_id"])
                    st.switch_page("pages/task-details.py")

    st.markdown("</div>", unsafe_allow_html=True)

# -----------------------------
# Right: Discussion (ClickUp-ish)
# -----------------------------
with right:
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Discussion</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>Keep project communication in one place.</div>", unsafe_allow_html=True)

    # Fetch comments
    comments = db.get_comments("project", pid) or []

    # Uses the updated render_chat_interface signature
    render_chat_interface(
        comments=comments,
        current_user_email=st.session_state.user_email,
        can_pin=True,
        db=db,
        entity_type="project",
        entity_id=pid,
        workspace_id=str(proj.get("workspace_id")) if proj.get("workspace_id") else None,
        project_id=pid,
        task_id=None,
        is_admin=bool(st.session_state.get("is_admin", False)),
    )

    st.markdown("</div>", unsafe_allow_html=True)

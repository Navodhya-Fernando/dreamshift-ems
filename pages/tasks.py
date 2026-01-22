import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Tasks", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

db = DreamShiftDB()

# Auth guard
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

# Workspace guard
ws_id = st.session_state.get("current_ws_id")
if not ws_id:
    st.markdown(
        """
        <div class="ds-empty-state">
          <div class="ds-empty-title">No workspace selected</div>
          <div class="ds-empty-sub">Select a workspace from the sidebar workspace switcher to view tasks.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.stop()

# Header (no emojis, SVG only)
icon = get_svg("tasks.svg", 28, 28)
st.markdown(
    f"""
    <div class="ds-page-head">
        <div class="ds-page-head-left">
            <div class="ds-page-icon">{icon}</div>
            <div class="ds-page-titles">
                <div class="ds-page-title">Tasks</div>
                <div class="ds-page-subtitle">Create, assign, and track tasks in this workspace.</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# -----------------------------
# Fetch members for assignee dropdown
# -----------------------------
members = db.get_workspace_members(ws_id) or []
member_display: list[str] = []
member_lookup: dict[str, str] = {}

for m in members:
    name = m.get("name") or m.get("email")
    email = m.get("email")
    if name and email:
        display = name
        if display in member_lookup:
            display = f"{name} ({email})"
        member_display.append(display)
        member_lookup[display] = email

# Default assignee = current user if present in members list
default_assignee_idx = 0
if st.session_state.user_email in member_lookup.values():
    # Find display label that maps to current user email
    for display, email in member_lookup.items():
        if email == st.session_state.user_email and display in member_display:
            default_assignee_idx = member_display.index(display)
            break

# -----------------------------
# Create Task (modern, minimal form)
# Requirements:
# Task Name, Assignee, Due Date, Priority
# -----------------------------
with st.expander("Create Task", expanded=False):
    st.markdown(
        "<div class='ds-form-head'>New task</div><div class='ds-form-sub'>Keep it short and assign it clearly.</div>",
        unsafe_allow_html=True,
    )

    with st.form("create_task_form", clear_on_submit=True):
        r1c1, r1c2 = st.columns([2.2, 1.2])
        with r1c1:
            task_name = st.text_input("Task Name", placeholder="e.g., Fix sidebar navigation")
        with r1c2:
            priority = st.selectbox("Priority", ["Low", "Medium", "High", "Critical"], index=1)

        r2c1, r2c2 = st.columns([1.6, 1.2])
        with r2c1:
            assignee_display = st.selectbox(
                "Assignee",
                member_display if member_display else ["Unassigned"],
                index=default_assignee_idx if member_display else 0,
            )
        with r2c2:
            due_date = st.date_input(
                "Due Date",
                value=datetime.date.today() + datetime.timedelta(days=1),
            )

        a1, a2 = st.columns([1.2, 4.8])
        create = a1.form_submit_button("Create", type="primary", use_container_width=True)
        cancel = a2.form_submit_button("Cancel", type="secondary", use_container_width=True)

        if cancel:
            st.stop()

        if create:
            if not (task_name or "").strip():
                st.error("Task Name is required.")
            else:
                assignee_email = member_lookup.get(assignee_display)  # may be None for Unassigned
                db.create_task(
                    ws_id=ws_id,
                    title=task_name.strip(),
                    desc="",  # optional
                    due_date=due_date,
                    assignee=assignee_email,
                    status="To Do",
                    priority=priority,
                    project_id=None,
                    creator=st.session_state.user_email,
                )
                st.success("Task created.")
                st.rerun()

# -----------------------------
# Active Tasks
# -----------------------------
st.markdown("<div class='ds-section-title'>Active Tasks</div>", unsafe_allow_html=True)
st.markdown("<div class='ds-section-sub'>Open items that are not completed.</div>", unsafe_allow_html=True)

tasks = db.get_tasks_with_urgency({"workspace_id": ws_id, "status": {"$ne": "Completed"}}) or []

if not tasks:
    st.markdown(
        "<div class='ds-empty-mini'>No active tasks in this workspace.</div>",
        unsafe_allow_html=True,
    )
    st.stop()

# Consistent display helper
def _assignee_name(email: str | None) -> str:
    if not email:
        return "Unassigned"
    for display, e in member_lookup.items():
        if e == email:
            return display
    return email

# Render task rows
for t in tasks:
    urgency_color = t.get("urgency_color", "rgba(255,255,255,0.18)")
    title = t.get("title", "Untitled")
    status = t.get("status", "To Do")
    prio = t.get("priority", "Medium")

    due = t.get("due_date")
    due_str = due.strftime("%b %d") if due else "No date"
    assignee_label = _assignee_name(t.get("assignee"))

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
                <div class="ds-task-meta-item">{assignee_label}</div>
                <div class="ds-task-meta-dot"></div>
                <div class="ds-task-meta-item">Due: {due_str}</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Clean CTA (Streamlit-safe)
    cbtn = st.columns([5.2, 1.1])
    with cbtn[1]:
        if st.button("Open", key=f"open_{t['_id']}", use_container_width=True, type="secondary"):
            st.session_state.selected_task_id = str(t["_id"])
            st.switch_page("pages/task-details.py")

import streamlit as st
import time
import datetime
from bson import ObjectId

from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg
from src.chat_ui import render_chat_interface
from src.mailer import notify_admins_extension

st.set_page_config(page_title="Task Details", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

db = DreamShiftDB()

# Auth guard
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

tid = st.session_state.get("selected_task_id")
if not tid:
    st.markdown(
        """
        <div class="ds-empty-state">
          <div class="ds-empty-title">No task selected</div>
          <div class="ds-empty-sub">Choose a task from the Tasks page to view details.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button("Go to Tasks", type="primary"):
        st.switch_page("pages/tasks.py")
    st.stop()

task = db.db.tasks.find_one({"_id": ObjectId(tid)})
if not task:
    st.error("Task not found.")
    st.stop()

# -----------------------------
# Header: back + title
# -----------------------------
icon = get_svg("tasks.svg", 22, 22)
head_left, head_right = st.columns([1, 9])

with head_left:
    if st.button("Back", type="secondary", use_container_width=True):
        st.switch_page("pages/tasks.py")

with head_right:
    st.markdown(
        f"""
        <div class="ds-page-head" style="padding:0; border:none; margin:0;">
            <div class="ds-page-head-left">
                <div class="ds-page-icon">{icon}</div>
                <div class="ds-page-titles">
                    <div class="ds-page-title">{task.get('title', 'Untitled Task')}</div>
                    <div class="ds-page-subtitle">Track progress, time, and discussions in one place.</div>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

st.markdown("<div class='ds-divider'></div>", unsafe_allow_html=True)

# -----------------------------
# Layout: left (work) / right (details)
# -----------------------------
left, right = st.columns([2.2, 1])

# -----------------------------
# Left: Subtasks + Comments
# -----------------------------
with left:
    # Subtasks card
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Subtasks</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>Break the task into small, trackable steps.</div>", unsafe_allow_html=True)

    subtasks = task.get("subtasks", []) or []

    # Progress row
    if subtasks:
        done = sum(1 for s in subtasks if s.get("completed"))
        pct = done / max(len(subtasks), 1)
        st.markdown(
            f"<div class='ds-progress-row'><div class='ds-progress-text'>{done}/{len(subtasks)} completed</div></div>",
            unsafe_allow_html=True,
        )
        st.progress(pct)
        st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
    else:
        st.markdown("<div class='ds-empty-mini'>No subtasks yet.</div>", unsafe_allow_html=True)
        st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)

    # Subtask list
    for s in subtasks:
        sid = s.get("id")
        title = s.get("title", "Untitled")
        completed = bool(s.get("completed"))

        c1, c2 = st.columns([0.08, 0.92])
        checked = c1.checkbox("", value=completed, key=f"sub_{sid}")
        with c2:
            st.markdown(
                f"<div class='ds-subtask-title'>{title}</div>",
                unsafe_allow_html=True,
            )

        if checked != completed:
            db.toggle_subtask(tid, sid, checked)
            st.rerun()

    # Add subtask (compact)
    st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
    with st.form("add_sub", clear_on_submit=True):
        new_sub = st.text_input("Add subtask", placeholder="Add a new subtask…", label_visibility="collapsed")
        a1, a2 = st.columns([1.2, 6.8])
        add = a1.form_submit_button("Add", type="secondary", use_container_width=True)
        if add:
            if not (new_sub or "").strip():
                st.error("Subtask title is required.")
            else:
                db.add_subtask(tid, new_sub.strip())
                st.rerun()

    st.markdown("</div>", unsafe_allow_html=True)

    # Comments card
    st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)

    # IMPORTANT: This expects the updated chat_ui.py version (comments passed in)
    # Fetch your comments through db helpers if available; fallback uses direct collection.
    try:
        comments = db.get_comments(entity_type="task", entity_id=tid)
    except Exception:
        comments = list(db.db.comments.find({"entity_type": "task", "entity_id": tid}).sort("created_at", -1))

    render_chat_interface(
        comments=comments,
        current_user_email=st.session_state.user_email,
        can_pin=True,
        db=db,
        entity_type="task",
        entity_id=tid,
        workspace_id=str(task.get("workspace_id")) if task.get("workspace_id") else None,
        project_id=str(task.get("project_id")) if task.get("project_id") else None,
        task_id=tid,
        is_admin=bool(st.session_state.get("is_admin", False)),
    )

    st.markdown("</div>", unsafe_allow_html=True)

# -----------------------------
# Right: Status + Time tracking + Extension
# -----------------------------
with right:
    # Details card
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Details</div>", unsafe_allow_html=True)

    # Status
    statuses = db.get_workspace_statuses(task["workspace_id"])
    curr_status_idx = statuses.index(task["status"]) if task.get("status") in statuses else 0

    new_status = st.selectbox("Status", statuses, index=curr_status_idx)
    if new_status != task.get("status"):
        db.update_task_status(tid, new_status)
        st.rerun()

    # Metadata
    due = task.get("due_date")
    prio = task.get("priority", "Medium")
    assignee = task.get("assignee")

    due_str = due.strftime("%b %d, %Y") if due else "Not set"
    assignee_str = assignee if assignee else "Unassigned"

    st.markdown(
        f"""
        <div class="ds-kv">
          <div class="ds-kv-row"><div class="ds-kv-k">Due date</div><div class="ds-kv-v">{due_str}</div></div>
          <div class="ds-kv-row"><div class="ds-kv-k">Priority</div><div class="ds-kv-v">{prio}</div></div>
          <div class="ds-kv-row"><div class="ds-kv-k">Assignee</div><div class="ds-kv-v">{assignee_str}</div></div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)

    # Time tracking card (Clockify-ish, clean)
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Time Tracking</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>Start the timer while you work. Logs are saved to this task.</div>", unsafe_allow_html=True)

    is_running = bool(st.session_state.get("timer_running")) and st.session_state.get("timer_task_id") == tid

    # Live display
    if is_running:
        elapsed = int(time.time() - st.session_state.timer_start)
        h, r = divmod(elapsed, 3600)
        m, s = divmod(r, 60)
        st.markdown(
            f"<div class='ds-timer-live'>{h:02}:{m:02}:{s:02}</div>",
            unsafe_allow_html=True,
        )
        if st.button("Stop", type="primary", use_container_width=True, key="stop_timer_btn"):
            db.log_time_entry(tid, st.session_state.user_email, elapsed)
            st.session_state.timer_running = False
            st.session_state.timer_start = None
            st.session_state.timer_task_id = None
            st.rerun()
    else:
        st.markdown("<div class='ds-timer-live'>00:00:00</div>", unsafe_allow_html=True)
        if st.button("Start", use_container_width=True, type="secondary", key="start_timer_btn"):
            st.session_state.timer_running = True
            st.session_state.timer_start = time.time()
            st.session_state.timer_task_id = tid
            st.session_state.timer_task_title = task.get("title", "Task")
            st.rerun()

    # Logs summary
    logs = db.get_task_time_entries(tid) or []
    total_sec = sum(l.get("seconds", 0) for l in logs)
    th, tr = divmod(total_sec, 3600)
    tm = tr // 60
    st.markdown(
        f"<div class='ds-muted'>Total tracked: <span class='ds-strong'>{th}h {tm}m</span></div>",
        unsafe_allow_html=True,
    )

    with st.expander("View logs"):
        if not logs:
            st.markdown("<div class='ds-empty-mini'>No logs yet.</div>", unsafe_allow_html=True)
        for l in logs:
            secs = int(l.get("seconds", 0))
            mm = secs // 60
            who = l.get("user_email", "User")
            st.markdown(
                f"<div class='ds-log-row'><div class='ds-log-who'>{who}</div><div class='ds-log-time'>{mm}m</div></div>",
                unsafe_allow_html=True,
            )

    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)

    # Extension request card
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Request Extension</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>Send a due date extension request to workspace admins.</div>", unsafe_allow_html=True)

    with st.form("ext_req"):
        d = st.date_input("New Date", value=(datetime.date.today() + datetime.timedelta(days=2)))
        r = st.text_area("Reason", placeholder="Explain why you need more time…")
        c1, c2 = st.columns([1.2, 4.8])
        submit = c1.form_submit_button("Submit", type="primary", use_container_width=True)
        cancel = c2.form_submit_button("Cancel", type="secondary", use_container_width=True)

        if cancel:
            st.stop()

        if submit:
            if not r.strip():
                st.error("Reason is required.")
            else:
                admins = db.request_extension(tid, st.session_state.user_email, d, r.strip())
                notify_admins_extension(admins, task.get("title", "Task"), st.session_state.user_email, r.strip())
                st.success("Request sent to admins.")

    st.markdown("</div>", unsafe_allow_html=True)

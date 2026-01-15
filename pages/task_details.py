"""
Task Details Page - Modern Minimal UI with Chat
Full task view with description, subtasks, discussion, time tracking
"""

import streamlit as st
import datetime
import time
from src.database import DreamShiftDB
from src.ui import load_global_css
from src.chat_ui import build_threads, render_comment

st.set_page_config(page_title="Task Details", page_icon="📋", layout="wide")
load_global_css()
db = DreamShiftDB()

# Auth
if "user_email" not in st.session_state or not st.session_state.user_email:
    st.warning("Please log in.")
    st.stop()

user_email = st.session_state.user_email
user_role = st.session_state.get("user_role", "")

task_id = st.session_state.get("selected_task_id")
if not task_id:
    st.error("No task selected.")
    st.stop()

task = db.get_task(task_id)
if not task:
    st.error("Task not found.")
    st.stop()

workspace_id = task.get("workspace_id")
if not db.get_workspace_member(workspace_id, user_email):
    st.error("Access denied.")
    st.stop()

project = db.get_project(task.get("project_id")) if task.get("project_id") else None
project_name = project.get("name") if project else "No Project"

# Header
st.markdown(f"""
<div class="ds-card">
  <div class="ds-subtitle">Project: {project_name}</div>
  <div class="ds-title">{task.get('title','Untitled Task')}</div>
</div>
""", unsafe_allow_html=True)

assignee = task.get("assignee")
assignee_name = db.get_display_name(assignee) if assignee else "Unassigned"
status = task.get("status", "Not Started")
priority = task.get("priority", "Medium")
due = task.get("due_date")
due_str = due.strftime("%b %d, %Y") if isinstance(due, datetime.datetime) else ("No deadline" if not due else str(due))
progress = int(task.get("completion_pct", 0))

st.markdown(f"""
<div class="ds-row" style="margin-top:12px;">
  <span class="ds-pill">Assignee: <b>{assignee_name}</b></span>
  <span class="ds-pill">Status: <b>{status}</b></span>
  <span class="ds-pill">Priority: <b>{priority}</b></span>
  <span class="ds-pill">Due: <b>{due_str}</b></span>
  <span class="ds-pill">Progress: <b style="color:#f6b900;">{progress}%</b></span>
</div>
""", unsafe_allow_html=True)

st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)

left, right = st.columns([2,1], gap="large")

with left:
    # Description
    st.markdown("### Description")
    desc = task.get("description", "No description.")
    st.markdown(f"<div class='ds-card'>{desc}</div>", unsafe_allow_html=True)

    # Subtasks
    st.markdown("### Subtasks")
    subtasks = task.get("subtasks", []) or []
    if subtasks:
        done = sum(1 for s in subtasks if s.get("completed"))
        pct = int((done/len(subtasks))*100) if subtasks else 0
        st.markdown(f"<div class='ds-card'><div class='ds-subtitle'>{done}/{len(subtasks)} completed ({pct}%)</div></div>", unsafe_allow_html=True)

        for s in subtasks:
            sid = s.get("id")
            title = s.get("title","")
            is_done = bool(s.get("completed"))
            c1, c2 = st.columns([1, 12])
            with c1:
                checked = st.checkbox("", value=is_done, key=f"sub_{sid}", label_visibility="collapsed")
            with c2:
                style = "text-decoration: line-through; opacity:0.55;" if checked else ""
                st.markdown(f"<div style='{style}'>{title}</div>", unsafe_allow_html=True)
            if checked != is_done:
                db.toggle_subtask(task_id, sid)
                st.rerun()
    else:
        st.info("No subtasks yet.")

    with st.expander("Add subtask"):
        with st.form("add_subtask"):
            t = st.text_input("Title")
            d = st.date_input("Due date (optional)", value=None)
            col_btn, col_spacer = st.columns([1, 8])
            with col_btn:
                if st.form_submit_button("Add"):
                    if t.strip():
                        db.add_subtask(task_id, t.strip(), d)
                        st.rerun()

    # Time tracking
    st.markdown("### Time tracking")
    total_time = db.get_total_time_for_task(task_id) or 0
    hours = int(total_time // 3600)
    mins = int((total_time % 3600)//60)
    st.markdown(f"<div class='ds-card'><div class='ds-subtitle'>Total</div><div style='font-size:22px;font-weight:900;color:#f6b900'>{hours}h {mins}m</div></div>", unsafe_allow_html=True)

    if "timer_running" not in st.session_state:
        st.session_state.timer_running = False

    if not st.session_state.timer_running:
        col_btn2, col_spacer2 = st.columns([1, 8])
        with col_btn2:
            if st.button("Start timer", type="primary"):
                st.session_state.timer_running = True
                st.session_state.timer_start = time.time()
                st.rerun()
    else:
        elapsed = int(time.time() - st.session_state.timer_start)
        st.markdown(f"<div class='ds-card' style='text-align:center;font-size:22px;font-weight:900;'>{elapsed//3600:02d}:{(elapsed%3600)//60:02d}:{elapsed%60:02d}</div>", unsafe_allow_html=True)
        col_btn3, col_spacer3 = st.columns([1, 8])
        with col_btn3:
            if st.button("Stop & log"):
                duration = int(time.time() - st.session_state.timer_start)
                db.log_time_entry(task_id, user_email, duration)
                st.session_state.timer_running = False
                st.rerun()

with right:
    # ───── ACTIONS ─────
    st.markdown("<div style='font-size:18px;font-weight:800;margin-bottom:12px;color:#fff;'>🎯 Actions</div>", unsafe_allow_html=True)
    
    # Status
    new_status = st.selectbox("Status", ["Not Started", "In Progress", "Completed"], index=["Not Started", "In Progress", "Completed"].index(status))
    col_btn4, col_spacer4 = st.columns([1, 5])
    with col_btn4:
        if st.button("Update Status", use_container_width=True):
            db.update_task_status(task_id, new_status)
            st.success(f"Status → {new_status}")
            st.rerun()
    
    # Priority
    priority_options = ["Low", "Medium", "High", "Critical"]
    # Handle legacy "Normal" priority by mapping it to "Medium"
    if priority not in priority_options:
        priority = "Medium"
    new_priority = st.selectbox("Priority", priority_options, index=priority_options.index(priority))
    col_btn5, col_spacer5 = st.columns([1, 5])
    with col_btn5:
        if st.button("Update Priority", use_container_width=True):
            db.update_task_priority(task_id, new_priority)
            st.success(f"Priority → {new_priority}")
            st.rerun()
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # ───── DETAILS ─────
    st.markdown("<div style='font-size:18px;font-weight:800;margin-bottom:12px;color:#fff;'>� Details</div>", unsafe_allow_html=True)
    
    created = task.get("created_at")
    updated = task.get("updated_at") or created
    created_str = created.strftime("%b %d, %Y") if created else "N/A"
    updated_str = updated.strftime("%b %d, %Y") if updated else "N/A"
    
    st.markdown(f"""
    <div style='background:#16213e;padding:14px;border-radius:8px;margin-bottom:12px;border:1px solid rgba(255,255,255,0.08);'>
      <div style='font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:8px;'>
        <span style='color:rgba(255,255,255,0.5);'>Created:</span> <span style='color:#fff;font-weight:700;'>{created_str}</span>
      </div>
      <div style='font-size:13px;color:rgba(255,255,255,0.7);'>
        <span style='color:rgba(255,255,255,0.5);'>Updated:</span> <span style='color:#fff;font-weight:700;'>{updated_str}</span>
      </div>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # ───── EXTENSION REQUEST ─────
    if assignee == user_email and status != "Completed":
        st.markdown("<div style='font-size:18px;font-weight:800;margin-bottom:12px;color:#fff;'>📅 Request Extension</div>", unsafe_allow_html=True)
        with st.form("extension_req_form"):
            new_deadline = st.date_input("New Deadline", value=due.date() if due else datetime.date.today())
            reason = st.text_area("Reason", height=100)
            col_btn6, col_spacer6 = st.columns([1, 5])
            with col_btn6:
                if st.form_submit_button("Submit Request"):
                    new_deadline_dt = datetime.datetime.combine(new_deadline, datetime.time.min)
                    db.create_extension_request(task_id, user_email, new_deadline_dt, reason)
                    st.success("Extension request submitted!")
                    st.rerun()

st.markdown("---")

# Discussion (full upgrades)
st.markdown("### Discussion")

if "reply_to_comment_id" not in st.session_state:
    st.session_state.reply_to_comment_id = None
if "edit_comment_id" not in st.session_state:
    st.session_state.edit_comment_id = None

can_pin = (user_role in ["Owner", "Workspace Admin"])

f1, f2 = st.columns([1, 2])
with f1:
    pinned_only = st.toggle("Pinned only", value=False)
with f2:
    members = db.get_workspace_members_for_mentions(workspace_id) or []
    mention_options = ["None"] + [f"{m['name']} ({m['email']})" for m in members]
    selected = st.selectbox("Mention", mention_options)

if "compose_comment" not in st.session_state:
    st.session_state.compose_comment = ""

if selected != "None":
    email = selected.split("(")[-1].replace(")", "").strip()
    tag = f"@{email}"
    if tag not in st.session_state.compose_comment:
        st.session_state.compose_comment = (st.session_state.compose_comment + " " + tag + " ").strip() + " "

comments = db.get_comments("task", task_id, pinned_only=pinned_only) or []

with st.form("add_task_comment"):
    text = st.text_area("Write a comment", value=st.session_state.compose_comment, height=110)
    b1, b2 = st.columns(2)
    post = b1.form_submit_button("Post", use_container_width=True)
    clear = b2.form_submit_button("Clear", use_container_width=True)
    if clear:
        st.session_state.compose_comment = ""
        st.rerun()
    if post:
        if text.strip():
            db.add_comment(
                entity_type="task",
                entity_id=task_id,
                user_email=user_email,
                text=text.strip(),
                workspace_id=workspace_id,
                project_id=task.get("project_id"),
                task_id=task_id,
                parent_comment_id=None
            )
            st.session_state.compose_comment = ""
            st.rerun()
        else:
            st.error("Comment cannot be empty.")

top, children = build_threads(comments)

if not pinned_only:
    pinned = [c for c in top if c.get("is_pinned")]
    if pinned:
        st.caption("📌 Pinned")
        for c in pinned:
            render_comment(
                c,
                current_user_email=user_email,
                can_pin=can_pin,
                db=db,
                entity_type="task",
                entity_id=task_id,
                workspace_id=workspace_id,
                project_id=task.get("project_id"),
                task_id=task_id,
                indent=False
            )
            for child in children.get(str(c["_id"]), []):
                render_comment(
                    child,
                    current_user_email=user_email,
                    can_pin=can_pin,
                    db=db,
                    entity_type="task",
                    entity_id=task_id,
                    workspace_id=workspace_id,
                    project_id=task.get("project_id"),
                    task_id=task_id,
                    indent=True
                )

st.caption("Threads")

threads = sorted(top, key=lambda x: x.get("created_at") or datetime.datetime.min, reverse=True)
for c in threads:
    if (not pinned_only) and c.get("is_pinned"):
        continue
    render_comment(
        c,
        current_user_email=user_email,
        can_pin=can_pin,
        db=db,
        entity_type="task",
        entity_id=task_id,
        workspace_id=workspace_id,
        project_id=task.get("project_id"),
        task_id=task_id,
        indent=False
    )
    for child in children.get(str(c["_id"]), []):
        render_comment(
            child,
            current_user_email=user_email,
            can_pin=can_pin,
            db=db,
            entity_type="task",
            entity_id=task_id,
            workspace_id=workspace_id,
            project_id=task.get("project_id"),
            task_id=task_id,
            indent=True
        )

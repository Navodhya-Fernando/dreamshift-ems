"""
Project Details Page - Modern Minimal UI
Shows project info, tasks, and basic chat
"""

import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar
from src.chat_ui import build_threads, render_comment

st.set_page_config(page_title="Project Details | DreamShift EMS", page_icon="static/icons/projects.svg", layout="wide", initial_sidebar_state="expanded")

# Hide default sidebar navigation and show custom sidebar
hide_streamlit_sidebar()
render_custom_sidebar()

# Load global CSS
load_global_css()

db = DreamShiftDB()

# Auth
if "user_email" not in st.session_state or not st.session_state.user_email:
    st.warning("Please log in.")
    st.stop()

user_email = st.session_state.user_email
user_role = st.session_state.get("user_role", "")

# Project id
params = st.query_params
project_id = params.get("id") or st.session_state.get("selected_project_id")
if not project_id:
    st.error("No project selected.")
    st.stop()

# --- BACK BUTTON ---
col_back, col_title = st.columns([1, 10])
with col_back:
    if st.button(":material/arrow_back: Back"):
        st.switch_page("pages/2_📁_Projects.py")

project = db.get_project(project_id)
if not project:
    st.error("Project not found.")
    st.stop()

workspace_id = project.get("workspace_id")
if not db.get_workspace_member(workspace_id, user_email):
    st.error("Access denied.")
    st.stop()

# Header
st.markdown(f"""
<div class="ds-card">
  <div class="ds-title">{project.get('name','Untitled Project')}</div>
  <div class="ds-subtitle">{project.get('description','No description')}</div>
</div>
""", unsafe_allow_html=True)

# Info pills
deadline = project.get("deadline")
deadline_str = deadline.strftime("%b %d, %Y") if isinstance(deadline, datetime.datetime) else ("No deadline" if not deadline else str(deadline))
status = project.get("status", "Active")
service = project.get("service_line", project.get("service", "N/A"))

st.markdown(f"""
<div class="ds-row" style="margin-top:12px;">
  <span class="ds-pill">Service: <b>{service}</b></span>
  <span class="ds-pill">Status: <b>{status}</b></span>
  <span class="ds-pill">Deadline: <b>{deadline_str}</b></span>
</div>
""", unsafe_allow_html=True)

# Stats
tasks = db.get_tasks_for_project(project_id) or []
total_tasks = len(tasks)
completed = sum(1 for t in tasks if t.get("status") == "Completed")
in_progress = sum(1 for t in tasks if t.get("status") == "In Progress")
completion = int((completed / total_tasks) * 100) if total_tasks else 0

c1, c2, c3, c4 = st.columns(4)
c1.metric("Total Tasks", total_tasks)
c2.metric("Completed", completed)
c3.metric("In Progress", in_progress)
c4.metric("Completion", f"{completion}%")

st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)

# Tasks list
st.markdown("### Tasks")

s1, s2, s3 = st.columns([2,1,1])
with s1:
    q = st.text_input("Search", "", placeholder="Search tasks...")
with s2:
    fs = st.selectbox("Status", ["All", "Not Started", "In Progress", "Completed"])
with s3:
    fp = st.selectbox("Priority", ["All", "Low", "Medium", "High", "Critical"])

filtered = tasks
if q:
    filtered = [t for t in filtered if q.lower() in (t.get("title","").lower())]
if fs != "All":
    filtered = [t for t in filtered if t.get("status") == fs]
if fp != "All":
    filtered = [t for t in filtered if t.get("priority") == fp]

if not filtered:
    st.info("No tasks found.")
else:
    for t in filtered:
        tid = str(t["_id"])
        title = t.get("title", "Untitled")
        st_status = t.get("status", "Not Started")
        prio = t.get("priority", "Medium")
        assignee = t.get("assignee")
        assignee_name = db.get_display_name(assignee) if assignee else "Unassigned"

        st.markdown(f"""
        <div class="ds-card" style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
                <div style="flex:1;">
                    <div style="font-weight:800; color:#fff;">
                        {title}
                    </div>

                    <div style="margin-top:6px;" class="ds-row">
                        <span class="ds-pill">
                        Status: <b>{st_status}</b>
                        </span>
                        <span class="ds-pill">
                        Priority: <b>{prio}</b>
                        </span>
                        <span class="ds-pill">
                        Assignee: <b>{assignee_name}</b>
                        </span>
                    </div>
                </div>
            </div>
        </div> """, unsafe_allow_html=True)

        if st.button("Open task", key=f"open_{tid}"):
            st.session_state.selected_task_id = tid
            st.switch_page("pages/task_details.py")

st.markdown("---")
# Discussion (with the same upgrades)
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
    mention_options = ["None"] + [f"{m['name']} ({m['email']}) {'✓' if m.get('is_member') else '○'}" for m in members]
    selected = st.selectbox("Mention", mention_options)

if "compose_comment" not in st.session_state:
    st.session_state.compose_comment = ""

if selected != "None":
    email = selected.split("(")[-1].replace(")", "").strip()
    tag = f"@{email}"
    if tag not in st.session_state.compose_comment:
        st.session_state.compose_comment = (st.session_state.compose_comment + " " + tag + " ").strip() + " "

comments = db.get_comments("project", project_id, pinned_only=pinned_only) or []

with st.form("add_project_comment"):
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
                entity_type="project",
                entity_id=project_id,
                user_email=user_email,
                text=text.strip(),
                workspace_id=workspace_id,
                project_id=project_id,
                task_id=None,
                parent_comment_id=None
            )
            st.session_state.compose_comment = ""
            st.rerun()
        else:
            st.error("Comment cannot be empty.")

top, children = build_threads(comments)

# Pinned section always first if not pinned_only
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
                entity_type="project",
                entity_id=project_id,
                workspace_id=workspace_id,
                project_id=project_id,
                task_id=None,
                indent=False
            )
            for child in children.get(str(c["_id"]), []):
                render_comment(
                    child,
                    current_user_email=user_email,
                    can_pin=can_pin,
                    db=db,
                    entity_type="project",
                    entity_id=project_id,
                    workspace_id=workspace_id,
                    project_id=project_id,
                    task_id=None,
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
        entity_type="project",
        entity_id=project_id,
        workspace_id=workspace_id,
        project_id=project_id,
        task_id=None,
        indent=False
    )
    for child in children.get(str(c["_id"]), []):
        render_comment(
            child,
            current_user_email=user_email,
            can_pin=can_pin,
            db=db,
            entity_type="project",
            entity_id=project_id,
            workspace_id=workspace_id,
            project_id=project_id,
            task_id=None,
            indent=True
        )

# 1. Use 2-column layout: left (main), right (metadata).
# 2. Use global card class for all cards.
# 3. Comments/activity: tight spacing, clear author/timestamp, subtle dividers.
# 4. Add empty state card (ds-empty-state) if no comments/activity.
# 5. Consistent button/input styles.
# 6. Add skeleton loader (ds-skeleton) for loading states.
# 7. Ensure consistent section/card/inline gaps using ds-gap-section, ds-gap-card, ds-gap-inline classes.


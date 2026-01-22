# pages/tasks.py (MODERN + MINIMAL rewrite)
# Notes:
# - Keeps ALL your existing features (board/list, filters, timer, create task)
# - Uses names instead of emails (assignee display only; input stays email for now)
# - Avoids heavy emoji UI, uses clean labels
# - Uses a safe render_html helper (prevents markdown code blocks)

import streamlit as st
import time
import datetime
import html
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

st.set_page_config(page_title="Tasks | DreamShift EMS", page_icon="static/icons/tasks.svg", layout="wide", initial_sidebar_state="expanded")
hide_streamlit_sidebar()
render_custom_sidebar()
load_global_css()

# ---------- helpers ----------
def render_html(html_str: str):
    cleaned = "\n".join([line.lstrip() for line in html_str.split("\n")])
    st.markdown(cleaned, unsafe_allow_html=True)

@st.cache_data(show_spinner=False, ttl=60)
def _name_cache(email: str):
    # cache wrapper to avoid hitting DB repeatedly while rendering
    return email

def user_label(db: DreamShiftDB, email: str) -> str:
    if not email:
        return "Unassigned"
    u = db.get_user(email)
    if u and u.get("name"):
        return u["name"]
    return email

def _get_workspace_doc(db: DreamShiftDB, ws_id: str, user_email: str):
    """
    Tries a few common DB methods so this works even if your DB class
    uses different function names.
    """
    # 1) Preferred: direct getter
    for fn_name in ("get_workspace", "get_workspace_by_id", "get_workspace_details"):
        fn = getattr(db, fn_name, None)
        if callable(fn):
            try:
                return fn(ws_id)
            except Exception:
                pass

    # 2) Fallback: search inside user's workspaces
    try:
        workspaces = db.get_user_workspaces(user_email)
        return next((ws for ws in workspaces if str(ws.get("_id")) == str(ws_id)), None)
    except Exception:
        return None

def _member_options(db: DreamShiftDB, ws_id: str, user_email: str):
    """
    Returns:
      options: list[str] labels for selectbox
      label_to_email: dict[label] = email
    """
    # Get all users from database instead of just workspace members
    all_users = db.get_all_users_for_mentions()

    labels = []
    label_to_email = {}

    for u in all_users:
        email = u.get("email")
        name = u.get("name") or email.split("@")[0]

        # avoid name collisions by including email in the label
        label = f"{name} · {email}"
        labels.append(label)
        label_to_email[label] = email

    # Sort by name part
    labels.sort(key=lambda x: x.lower())
    return labels, label_to_email

def fmt_due(d):
    if isinstance(d, datetime.datetime):
        return d.strftime("%b %d")
    return "No date"

def fmt_due_long(d):
    if isinstance(d, datetime.datetime):
        return d.strftime("%b %d, %Y")
    return "No deadline"

def priority_tag(p: str):
    p = (p or "Normal").strip()
    klass = {
        "Urgent": "tag tag-danger",
        "High": "tag tag-warn",
        "Normal": "tag tag-neutral",
        "Low": "tag tag-neutral",
    }.get(p, "tag tag-neutral")
    return p, klass

def status_badge(s: str):
    s = (s or "To Do").strip()
    klass = {
        "Completed": "badge badge-success",
        "Blocked": "badge badge-warning",
        "In Progress": "badge badge-primary",
        "In Review": "badge badge-primary",
        "To Do": "badge badge-primary",
    }.get(s, "badge badge-primary")
    return s, klass

db = DreamShiftDB()

# ---------- auth ----------
if "user_email" not in st.session_state:
    st.error("Please login first.")
    st.stop()

if "current_ws_id" not in st.session_state:
    st.warning("Please select a workspace on the Workspaces page.")
    st.stop()

ws_id = st.session_state.current_ws_id
user_email = st.session_state.user_email
role = db.get_user_role(ws_id, user_email)

# ---------- header ----------
if "task_view" not in st.session_state:
    st.session_state.task_view = "board"

left, right = st.columns([7, 3])
with left:
    render_html("""
    <div class="ds-head">
      <div>
        <div class="ds-title" style="display:flex; align-items:center; gap:10px;">
            :material/check_circle: Tasks
        </div>
        <div class="ds-sub">Manage your daily work</div>
      </div>
    </div>
    """)
with right:
    col_btn, col_spacer = st.columns([1, 5])
    with col_btn:
        if st.button(":material/view_kanban:", help="Board View", use_container_width=True):
            st.session_state.task_view = "board"
            st.rerun()
    with col_spacer:
        st.empty()
    
    col_btn2, col_spacer2 = st.columns([1, 5])
    with col_btn2:
        if st.button(":material/view_list:", help="List View", use_container_width=True):
            st.session_state.task_view = "list"
            st.rerun()
    with col_spacer2:
        st.empty()

# ---------- sidebar timer ----------
with st.sidebar:
    st.markdown("### Timer")

    render_html("""
    <div class="ds-card">
      <div style="color:rgba(255,255,255,.65);font-size:13px;">Start a timer and log it to a task.</div>
    </div>
    """)

    if "is_running" not in st.session_state:
        st.session_state.is_running = False

    if not st.session_state.is_running:
        col_btn3, col_spacer3 = st.columns([1, 5])
        with col_btn3:
            if st.button("Start", use_container_width=True):
                st.session_state.is_running = True
                st.session_state.start_time = time.time()
                st.rerun()
    else:
        elapsed = time.time() - st.session_state.start_time
        mm = int(elapsed // 60)
        ss = int(elapsed % 60)
        render_html(f"<div class='ds-timer'>{mm:02d}:{ss:02d}</div>")

        col_btn4, col_spacer4 = st.columns([1, 5])
        with col_btn4:
            if st.button("Stop & log", use_container_width=True):
                st.session_state.show_log_time = True
                st.session_state.elapsed_time = int(elapsed)
                st.session_state.is_running = False
                st.rerun()

    if st.session_state.get("show_log_time", False):
        st.markdown("---")
        st.markdown("Log time")

        user_tasks = db.get_tasks_with_urgency({"assignee": user_email, "workspace_id": ws_id})
        task_map = {f"{t['title']} ({t.get('project_name', 'No Project')})": str(t["_id"]) for t in user_tasks}

        if not task_map:
            st.info("No assigned tasks.")
        else:
            pick = st.selectbox("Task", list(task_map.keys()))
            col_btn5, col_spacer5 = st.columns([1, 5])
            with col_btn5:
                if st.button("Save", use_container_width=True):
                    db.log_time_entry(
                        task_id=task_map[pick],
                        user_email=user_email,
                        duration=st.session_state.elapsed_time,
                    )
                    st.success("Time logged.")
                    del st.session_state.show_log_time
                    del st.session_state.elapsed_time
                    st.rerun()

            col_btn6, col_spacer6 = st.columns([1, 5])
            with col_btn6:
                if st.button("Cancel", use_container_width=True):
                    del st.session_state.show_log_time
                    st.rerun()

# ---------- filters ----------
st.markdown("### Filters")

project_map = {p["name"]: str(p["_id"]) for p in db.get_projects(ws_id)}
project_names = list(project_map.keys())

member_labels, label_to_email = _member_options(db, ws_id, user_email)

# Compact filter row: place all filters in a single st.columns row, short labels.
f1, f2, f3, f4 = st.columns([2.2, 1.2, 1.4, 1.4])

with f1:
    search_query = st.text_input("Search", placeholder="Search title or description...", label_visibility="collapsed")

with f2:
    project_choice = st.selectbox(
        "Project",
        ["All Projects"] + project_names,
        label_visibility="collapsed"
    )

with f3:
    # Show names but filter by email
    assignee_choice = st.selectbox(
        "Assignee",
        ["All Team Members", "My Tasks"] + member_labels,
        label_visibility="collapsed"
    )

with f4:
    priority_choice = st.multiselect(
        "Priority",
            ["Low", "Normal", "High", "Urgent"],
            default=["Low", "Normal", "High", "Urgent"],
            label_visibility="collapsed"
        )

# Build query based on filters
query = {"workspace_id": ws_id}

# Project filter
if project_choice != "All Projects":
    query["project_id"] = project_map[project_choice]

# Assignee filter (email)
if assignee_choice == "My Tasks":
    query["assignee"] = user_email
elif assignee_choice not in ("All Team Members", "My Tasks"):
    query["assignee"] = label_to_email.get(assignee_choice)

# Fetch tasks
all_tasks = db.get_tasks_with_urgency(query)

# Priority filter
tasks = [t for t in all_tasks if t.get("priority", "Normal") in priority_choice]

# Search filter
if search_query:
    ql = search_query.lower()
    def _match(t):
        return (ql in (t.get("title", "") or "").lower()) or (ql in (t.get("description", "") or "").lower())
    tasks = [t for t in tasks if _match(t)]

# ---------- board ----------
if st.session_state.task_view == "board":
    statuses = ["To Do", "In Progress", "In Review", "Blocked", "Completed"]
    cols = st.columns(len(statuses), gap="small")

    for i, status in enumerate(statuses):
        with cols[i]:
            status_tasks = [t for t in tasks if t.get("status") == status]
            render_html(f"<div class='ds-kanban-head'><span>{html.escape(status)}</span><span class='ds-count'>{len(status_tasks)}</span></div>")

            if not status_tasks:
                render_html("<div class='ds-card' style='text-align:center;color:rgba(255,255,255,.55);'>No tasks</div>")
                continue

            for task in status_tasks:
                task_id = str(task["_id"])
                title = html.escape(task.get("title", "Untitled"))
                assignee_name = html.escape(user_label(db, task.get("assignee")))
                due_str = html.escape(fmt_due(task.get("due_date")))
                pr, pr_cls = priority_tag(task.get("priority", "Normal"))
                pct = int(task.get("completion_pct", 0))
                urg = task.get("urgency_color", "#f6b900")

                render_html(f"""
                <div class="ds-task" style="border-left:3px solid {urg};">
                  <div class="t">{title}</div>
                  <div class="m">
                    <div>Assignee: {assignee_name}</div>
                    <div>Due: {due_str}</div>
                    <div>Priority: {html.escape(pr)}</div>
                  </div>
                  <div class="ds-progress"><div style="width:{pct}%"></div></div>
                </div>
                """)

                a1, a2 = st.columns(2, gap="small")
                with a1:
                    if st.button("View", key=f"view_{task_id}_{status}", use_container_width=True):
                        st.session_state.selected_task_id = task_id
                        st.switch_page("pages/task_details.py")
                with a2:
                    if status != "Completed":
                        next_status = {
                            "To Do": "In Progress",
                            "In Progress": "In Review",
                            "In Review": "Completed",
                            "Blocked": "In Progress",
                        }.get(status, "Completed")

                        if st.button("Move", key=f"move_{task_id}_{status}", use_container_width=True):
                            db.update_task_status(task_id, next_status)
                            st.rerun()

# ---------- list ----------
else:
    top1, top2 = st.columns([4, 2])
    with top1:
        st.write(f"**{len(tasks)} tasks**")
    with top2:
        sort_by = st.selectbox("Sort", ["Due Date", "Priority", "Status", "Title"])

    if sort_by == "Due Date":
        tasks.sort(key=lambda x: x.get("due_date", datetime.datetime.max))
    elif sort_by == "Priority":
        order = {"Urgent": 0, "High": 1, "Normal": 2, "Low": 3}
        tasks.sort(key=lambda x: order.get(x.get("priority", "Normal"), 2))
    elif sort_by == "Status":
        tasks.sort(key=lambda x: x.get("status", ""))
    else:
        tasks.sort(key=lambda x: x.get("title", ""))

    for task in tasks:
        task_id = str(task["_id"])
        title = html.escape(task.get("title", "Untitled"))
        status_txt, status_cls = status_badge(task.get("status", "To Do"))
        pr_txt, _ = priority_tag(task.get("priority", "Normal"))
        assignee_name = html.escape(user_label(db, task.get("assignee")))
        due_long = html.escape(fmt_due_long(task.get("due_date")))
        proj_name = html.escape(task.get("project_name", "No Project"))
        pct = int(task.get("completion_pct", 0))
        urg = task.get("urgency_color", "#f6b900")

        render_html(f"""
        <div class="ds-card" style="border-left:3px solid {urg};">
          <div class="ds-row">
            <div style="flex:1;">
              <h4 style="margin:0;color:#fff;font-weight:950;">{title}</h4>
              <div class="ds-meta">Assignee: {assignee_name} • Project: {proj_name}</div>
              <div class="ds-meta">Due: {due_long} • Priority: {html.escape(pr_txt)}</div>
              <div class="ds-progress"><div style="width:{pct}%"></div></div>
            </div>
            <div style="min-width:120px;text-align:right;">
              <span class="{status_cls}">{html.escape(status_txt)}</span>
              <div style="height:10px"></div>
              <div style="color:rgba(255,255,255,.7);font-weight:900;">{pct}%</div>
            </div>
          </div>
        </div>
        """)

        b1, b2, b3 = st.columns([2, 2, 2], gap="small")
        with b1:
            if st.button("View", key=f"lv_{task_id}", use_container_width=True):
                st.session_state.selected_task_id = task_id
                st.switch_page("pages/task_details.py")
        with b2:
            if task.get("status") != "Completed":
                if st.button("Complete", key=f"done_{task_id}", use_container_width=True):
                    db.update_task_status(task_id, "Completed")
                    st.rerun()
        with b3:
            if task.get("status") == "To Do":
                if st.button("Start", key=f"start_{task_id}", use_container_width=True):
                    db.update_task_status(task_id, "In Progress")
                    st.rerun()

# ---------- create task (admins/owners) ----------
if role in ["Owner", "Workspace Admin"]:
    st.markdown("---")
    with st.expander("Create task"):
        with st.form("create_task_form"):
            task_title = st.text_input("Title", placeholder="e.g., Draft CV (V1)")
            task_desc = st.text_area("Description (optional)", placeholder="Context, requirements, links...")

            # Reuse project_map from filters section
            create_project_map = {p["name"]: str(p["_id"]) for p in db.get_projects(ws_id)}
            c1, c2 = st.columns(2)
            selected_project = c1.selectbox("Project", list(create_project_map.keys()) if create_project_map else ["No Projects"])
            
            # Assignee picker with names
            assignee_labels, label_to_email = _member_options(db, ws_id, user_email)
            if not assignee_labels:
                task_assignee = c2.text_input("Assignee email", placeholder="user@company.com")
            else:
                # Default to current user if present
                my_label = next((lbl for lbl, em in label_to_email.items() if em == user_email), None)
                default_index = assignee_labels.index(my_label) if my_label in assignee_labels else 0
                
                assignee_pick = c2.selectbox(
                    "Assignee",
                    assignee_labels,
                    index=default_index,
                    help="Select a team member"
                )
                task_assignee = label_to_email[assignee_pick]

            c3, c4 = st.columns(2)
            task_due_date = c3.date_input("Due date", min_value=datetime.date.today())
            task_priority = c4.selectbox("Priority", ["Low", "Normal", "High", "Urgent"], index=1)

            c5, c6 = st.columns(2)
            is_recurring = c5.checkbox("Recurring task")
            recurrence_pattern = None
            if is_recurring:
                recurrence_pattern = c6.selectbox("Recurrence", ["Daily", "Weekly", "Monthly", "Custom"])

            if st.form_submit_button("Create", use_container_width=True):
                if task_title and task_assignee and create_project_map:
                    db.create_task(
                        project_id=create_project_map[selected_project],
                        ws_id=ws_id,
                        title=task_title.strip(),
                        desc=(task_desc or "").strip(),
                        assignee=task_assignee.strip(),
                        due_date=datetime.datetime.combine(task_due_date, datetime.time()),
                        priority=task_priority,
                        is_recurring=is_recurring,
                        recurrence_pattern=recurrence_pattern.lower() if recurrence_pattern else None,
                    )
                    st.success("Task created.")
                    st.rerun()
                else:
                    st.error("Please fill in all required fields.")

    st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)
    if st.button("Manage task templates", use_container_width=True, type="secondary"):
        st.switch_page("pages/task_templates.py")

st.markdown("---")
render_html("<div style='text-align:center;color:rgba(255,255,255,.55);font-size:13px;'>Use filters to find tasks quickly.</div>")

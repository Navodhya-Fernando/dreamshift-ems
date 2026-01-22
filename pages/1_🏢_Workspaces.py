import streamlit as st
from src.database import DreamShiftDB
import datetime
import html

# Page config
st.set_page_config(page_title="Workspaces | DreamShift EMS", page_icon="🏢", layout="wide", initial_sidebar_state="collapsed")

# Load custom CSS and setup
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

# Hide default Streamlit sidebar
hide_streamlit_sidebar()

# Render custom sidebar
render_custom_sidebar()

# Load global CSS
load_global_css()

# Helpers
def render_html(html_str: str):
    """Strip leading whitespace so Streamlit does not treat it as code."""
    cleaned = "\n".join([line.lstrip() for line in html_str.split("\n")])
    st.markdown(cleaned, unsafe_allow_html=True)

# App
db = DreamShiftDB()

# Auth
if "user_email" not in st.session_state:
    st.error("Please login on the Home page first.")
    st.stop()

user_email = st.session_state.user_email
user = db.get_user(user_email)

# Get all workspaces (not just user's)
all_workspaces = db.get_all_workspaces()

# Empty state: no workspaces exist
if not all_workspaces:
    render_html(
        """
<div class="ds-card">
  <div class="ds-page-title">Workspace Management</div>
  <p class="ds-page-sub">Create your first workspace to get started.</p>
</div>
"""
    )

    st.markdown("<div style='height:14px;'></div>", unsafe_allow_html=True)

    with st.form("create_first_ws"):
        ws_name = st.text_input("Workspace Name", placeholder="e.g., Marketing Team, Development, Client Projects")
        col_btn, col_spacer = st.columns([1, 8])
        with col_btn:
            submitted = st.form_submit_button("Create Workspace", use_container_width=True)
        if submitted:
            if ws_name.strip():
                db.create_workspace(ws_name.strip(), user_email)
                st.success("Workspace created successfully.")
                st.rerun()
            else:
                st.error("Please enter a workspace name.")
    st.stop()

# Get user's workspaces (those they're members of)
user_workspaces = db.get_user_workspaces(user_email)
user_ws_ids = {str(ws["_id"]) for ws in user_workspaces}

# Try to use previous selection, fallback to first workspace
previous_ws_id = st.session_state.get("current_ws_id")
if previous_ws_id and any(str(ws["_id"]) == previous_ws_id for ws in all_workspaces):
    selected_ws_id = previous_ws_id
else:
    selected_ws_id = str(all_workspaces[0]["_id"]) if all_workspaces else None

# ------------------------------------------------------------
# Sidebar: minimal selector
# ------------------------------------------------------------
with st.sidebar:
    # Keep it simple and consistent with your global sidebar styling
    st.markdown("### Workspace")
    ws_map = {ws["name"]: str(ws["_id"]) for ws in all_workspaces}
    ws_names = list(ws_map.keys())
    
    # Find the display name for current selection
    current_name = next((name for name, id in ws_map.items() if id == selected_ws_id), ws_names[0] if ws_names else None)
    current_index = ws_names.index(current_name) if current_name in ws_names else 0
    
    selected_name = st.selectbox("", ws_names, key="ws_selector", label_visibility="collapsed", index=current_index)
    ws_id = ws_map[selected_name]
    st.session_state.current_ws_id = ws_id
    st.session_state.current_ws_name = selected_name

    # Check if user is member of selected workspace
    role = db.get_user_role(ws_id, user_email)
    is_member = role is not None
    st.session_state.user_role = role if is_member else "Guest"
    st.session_state.is_workspace_member = is_member
    
    # Show membership status and role
    if is_member:
        membership_badge = f'<span class="ds-pill ds-pill-accent">✓ {html.escape(role)}</span>'
    else:
        membership_badge = '<span class="ds-pill" style="color: rgba(255,255,255,0.65);">○ Guest</span>'
    
    st.markdown(
        f"""
        <div style="margin-top:10px; display:flex; gap:8px; align-items:center;">
          {membership_badge}
          <span class="ds-pill">{html.escape(selected_name)}</span>
        </div>
        """,
        unsafe_allow_html=True,
    )

# Selected workspace + stats
selected_ws = next((ws for ws in all_workspaces if str(ws["_id"]) == ws_id), None)
if not selected_ws:
    st.error("Workspace not found.")
    st.stop()

ws_stats = db.get_workspace_stats(ws_id)

# ------------------------------------------------------------
# Header + metrics
# ------------------------------------------------------------
render_html(
    f"""
<div class="ds-card">
  <div class="ds-page-title">Workspace Management</div>
  <p class="ds-page-sub">Manage projects and team members for <span style="color:#f6b900; font-weight:800;">{html.escape(selected_name)}</span>.</p>

  <div class="ds-metrics">
    <div class="ds-metric">
      <div class="ds-metric-label">Projects</div>
      <div class="ds-metric-value">{ws_stats["total_projects"]}</div>
    </div>
    <div class="ds-metric">
      <div class="ds-metric-label">Tasks</div>
      <div class="ds-metric-value">{ws_stats["total_tasks"]}</div>
    </div>
    <div class="ds-metric">
      <div class="ds-metric-label">Members</div>
      <div class="ds-metric-value">{len(selected_ws.get("members", []))}</div>
    </div>
    <div class="ds-metric">
      <div class="ds-metric-label">Completion</div>
      <div class="ds-metric-value">{round((ws_stats["completed_tasks"] / ws_stats["total_tasks"] * 100) if ws_stats["total_tasks"] else 0)}%</div>
    </div>
  </div>
</div>
"""
)

st.markdown("<div style='height:14px;'></div>", unsafe_allow_html=True)

# ------------------------------------------------------------
# Tabs
# ------------------------------------------------------------
tab_projects, tab_team, tab_settings, tab_analytics = st.tabs(["Projects", "Team", "Settings", "Analytics"])

# ------------------------------------------------------------
# Projects tab (grid + right-side create panel)
# ------------------------------------------------------------
with tab_projects:
    # Two-column layout: projects (left) + actions (right)
    left, right = st.columns([2.2, 1])

    projects = db.get_projects(ws_id)

    with left:
        render_html(
            """
<div class="ds-card-tight">
  <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
    <div>
      <div style="font-weight:900; color:#fff; font-size:1.05rem;">Projects</div>
      <div style="margin-top:6px; color:rgba(255,255,255,0.65); font-size:0.85rem;">A clean overview of work in this workspace.</div>
    </div>
  </div>
</div>
"""
        )
        st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

        if not projects:
            st.info("No projects in this workspace yet.")
        else:
            cols = st.columns(2)
            for i, project in enumerate(projects):
                c = cols[i % 2]

                name = html.escape(project.get("name", ""))
                desc = html.escape((project.get("description") or "").strip() or "No description")
                service = (project.get("service") or "").strip()
                service_safe = html.escape(service) if service else ""
                status = (project.get("status") or "Active").strip()
                deadline_dt = project.get("deadline")
                deadline = deadline_dt.strftime("%b %d, %Y") if deadline_dt else "No deadline"
                progress = int(project.get("completion_percentage", 0))

                status_badge = "ds-badge-accent"
                if status.lower() == "completed":
                    status_badge = "ds-badge-ok"
                elif status.lower() in ["on hold", "cancelled"]:
                    status_badge = "ds-badge-warn"

                with c:
                    render_html(
                        f"""
<div class="ds-proj-card">
  <div class="ds-proj-top">
    <div style="min-width:0;">
      <div class="ds-proj-title">{name}</div>
      <div class="ds-proj-desc">{desc}</div>
    </div>
    <span class="ds-badge {status_badge}">{html.escape(status)}</span>
  </div>

  <div class="ds-proj-meta">
    <span>Deadline: {deadline}</span>
    <span>Progress: {progress}%</span>
    {f"<span>Service: {service_safe}</span>" if service_safe else ""}
  </div>

  <div class="ds-proj-bar"><div style="width:{progress}%;"></div></div>
</div>
"""
                    )

                    col_btn2, col_spacer2 = st.columns([1, 8])
                    with col_btn2:
                        if st.button("View", key=f"view_proj_{project['_id']}", use_container_width=True):
                            st.session_state.selected_project_id = str(project["_id"])
                            st.switch_page("pages/project_details.py")

    with right:
        # Action panel
        render_html(
            """
<div class="ds-card">
  <div style="font-weight:900; color:#fff; font-size:1.05rem;">Actions</div>
  <div style="margin-top:6px; color:rgba(255,255,255,0.65); font-size:0.85rem;">
    Create a new project or manage workspace.
  </div>
</div>
"""
        )
        st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

        if st.session_state.user_role in ["Owner", "Workspace Admin"]:
            with st.expander("Create Project", expanded=True):
                with st.form("new_project_form"):
                    proj_name = st.text_input("Project Name", placeholder="e.g., Website Redesign")
                    proj_desc = st.text_area("Description (optional)", placeholder="Short summary of the goal")
                    proj_service = st.text_input("Service/Package (optional)", placeholder="Leave empty if not needed")

                    col_a, col_b = st.columns(2)
                    proj_deadline = col_a.date_input("Deadline", min_value=datetime.date.today())
                    proj_status = col_b.selectbox("Status", ["Active", "On Hold", "Completed", "Cancelled"])

                    col_btn3, col_spacer3 = st.columns([1, 8])
                    with col_btn3:
                        submitted = st.form_submit_button("Create", use_container_width=True)
                    if submitted:
                        if not proj_name.strip():
                            st.error("Please enter a project name.")
                        else:
                            db.create_project(
                                workspace_id=ws_id,
                                name=proj_name.strip(),
                                description=(proj_desc or "").strip(),
                                service=(proj_service or "").strip() or None,  # optional
                                deadline=datetime.datetime.combine(proj_deadline, datetime.time()),
                                status=proj_status,
                                created_by=user_email,
                            )
                            st.success("Project created successfully.")
                            st.rerun()
        else:
            st.info("Only workspace admins or owners can create projects.")

# ------------------------------------------------------------
# Team tab
# ------------------------------------------------------------
with tab_team:
    members = selected_ws.get("members", [])

    render_html(
        """
<div class="ds-card-tight">
  <div style="font-weight:900; color:#fff; font-size:1.05rem;">Team</div>
  <div style="margin-top:6px; color:rgba(255,255,255,0.65); font-size:0.85rem;">People who can access this workspace.</div>
</div>
"""
    )
    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

    if not members:
        st.info("No members found.")
    else:
        for member in members:
            member_user = db.get_user(member["email"])
            if not member_user:
                continue

            name = html.escape(member_user.get("name", member["email"]))
            email = html.escape(member["email"])
            mrole = html.escape(member.get("role", "Employee"))
            initial = html.escape((member_user.get("name", "U")[:1]).upper())

            render_html(
                f"""
<div class="ds-proj-card" style="margin-bottom:10px;">
  <div class="ds-proj-top">
    <div style="display:flex; gap:12px; align-items:center; min-width:0;">
      <div style="width:44px; height:44px; border-radius:14px; background:rgba(246,185,0,0.14); border:1px solid rgba(246,185,0,0.28); display:flex; align-items:center; justify-content:center; color:#f6b900; font-weight:900;">
        {initial}
      </div>
      <div style="min-width:0;">
        <div class="ds-proj-title" style="font-size:1rem;">{name}</div>
        <div class="ds-proj-desc" style="margin-top:4px;">{email}</div>
      </div>
    </div>
    <span class="ds-badge ds-badge-accent">{mrole}</span>
  </div>
</div>
"""
            )

            # Role management (Owner only, not self)
            if st.session_state.user_role == "Owner" and member["email"] != user_email:
                col_x, col_y = st.columns([3, 1])
                with col_x:
                    new_role = st.selectbox(
                        "Role",
                        ["Employee", "Workspace Admin"],
                        key=f"role_{member['email']}",
                        index=0 if member.get("role") == "Employee" else 1,
                    )
                with col_y:
                    col_btn4, col_spacer4 = st.columns([1, 5])
                    with col_btn4:
                        if st.button("Update", key=f"update_{member['email']}", use_container_width=True):
                            db.update_member_role(ws_id, member["email"], new_role)
                            st.success("Role updated.")
                            st.rerun()
                    col_btn5, col_spacer5 = st.columns([1, 5])
                    with col_btn5:
                        if st.button("Remove", key=f"remove_{member['email']}", use_container_width=True):
                            db.remove_workspace_member(ws_id, member["email"])
                            st.success("Member removed.")
                            st.rerun()

    # Invite section
    if st.session_state.user_role in ["Owner", "Workspace Admin"]:
        st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)
        with st.expander("Invite Member", expanded=False):
            with st.form("invite_member"):
                invite_email = st.text_input("Email", placeholder="colleague@company.com")
                invite_role = st.selectbox("Role", ["Employee", "Workspace Admin"])
                col_btn6, col_spacer6 = st.columns([1, 5])
                with col_btn6:
                    submitted = st.form_submit_button("Add to workspace", use_container_width=True)

                if submitted:
                    if not invite_email.strip():
                        st.error("Please enter an email address.")
                    else:
                        invited_user = db.get_user(invite_email.strip())
                        if not invited_user:
                            st.error("User not found. They need to sign up first.")
                        elif invite_email.strip() in [m["email"] for m in members]:
                            st.error("User is already a member of this workspace.")
                        else:
                            db.add_workspace_member(ws_id, invite_email.strip(), invite_role)
                            st.success("Member added.")
                            st.rerun()

# ------------------------------------------------------------
# Settings tab
# ------------------------------------------------------------
with tab_settings:
    render_html(
        """
<div class="ds-card-tight">
  <div style="font-weight:900; color:#fff; font-size:1.05rem;">Settings</div>
  <div style="margin-top:6px; color:rgba(255,255,255,0.65); font-size:0.85rem;">Workspace configuration and dangerous actions.</div>
</div>
"""
    )
    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
    
    # Create New Workspace section
    with st.expander("➕ Create New Workspace", expanded=False):
        with st.form("create_new_workspace"):
            new_ws_name = st.text_input("Workspace Name", placeholder="e.g., Marketing Team, Development, Client Projects")
            col_btn7, col_spacer7 = st.columns([1, 5])
            with col_btn7:
                submitted_create = st.form_submit_button("Create Workspace", use_container_width=True)
            if submitted_create:
                if not new_ws_name.strip():
                    st.error("Please enter a workspace name.")
                else:
                    db.create_workspace(new_ws_name.strip(), user_email)
                    st.success("Workspace created successfully!")
                    st.rerun()
    
    st.markdown("<div style='height:14px;'></div>", unsafe_allow_html=True)

    if st.session_state.user_role != "Owner":
        st.info("Only workspace owners can modify settings.")
    else:
        with st.form("edit_workspace"):
            new_ws_name = st.text_input("Workspace name", value=selected_ws["name"])
            col_btn8, col_spacer8 = st.columns([1, 5])
            with col_btn8:
                submitted = st.form_submit_button("Save", use_container_width=True)
            if submitted:
                if not new_ws_name.strip():
                    st.error("Workspace name cannot be empty.")
                else:
                    db.update_workspace(ws_id, {"name": new_ws_name.strip()})
                    st.success("Workspace updated.")
                    st.rerun()

        st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)
        render_html(
            """
<div class="ds-card" style="border-color: rgba(255,77,77,0.28); background: rgba(255,77,77,0.06);">
  <div style="font-weight:900; color:#fff; font-size:1.05rem;">Danger zone</div>
  <div style="margin-top:6px; color:rgba(255,255,255,0.72); font-size:0.85rem;">
    Deleting a workspace removes all projects and tasks permanently.
  </div>
</div>
"""
        )

        st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)

        col_btn9, col_spacer9 = st.columns([1, 5])
        with col_btn9:
            if st.button("Delete workspace", type="secondary"):
                st.session_state.confirm_delete = True

        if st.session_state.get("confirm_delete", False):
            st.error("Confirm deletion. This cannot be undone.")
            c1, c2 = st.columns(2)
            if c1.button("Delete permanently", use_container_width=True):
                db.delete_workspace(ws_id)
                st.success("Workspace deleted.")
                st.session_state.confirm_delete = False
                st.rerun()
            if c2.button("Cancel", use_container_width=True):
                st.session_state.confirm_delete = False
                st.rerun()

# ------------------------------------------------------------
# Analytics tab (aligned to start near "To Do")
# ------------------------------------------------------------
with tab_analytics:
  render_html(
    """
<div class="ds-card-tight" style="margin-left:12px;">
  <div style="font-weight:900; color:#fff; font-size:1.05rem;">Analytics</div>
  <div style="margin-top:6px; color:rgba(255,255,255,0.65); font-size:0.85rem;">Quick snapshot of task distribution and team performance.</div>
</div>
"""
  )
  st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

  c1, c2, c3 = st.columns([1, 1, 1])
  with c1:
    st.metric("To Do", ws_stats["todo_tasks"])
  with c2:
    st.metric("In Progress", ws_stats["in_progress_tasks"])
  with c3:
    st.metric("Completed", ws_stats["completed_tasks"])

    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

    if st.session_state.user_role in ["Owner", "Workspace Admin"]:
        render_html(
            """
<div class="ds-card-tight">
  <div style="font-weight:900; color:#fff; font-size:1.05rem;">Team performance</div>
  <div style="margin-top:6px; color:rgba(255,255,255,0.65); font-size:0.85rem;">Top-level stats per member.</div>
</div>
"""
        )
        st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

        members = selected_ws.get("members", [])
        for member in members:
            member_stats = db.get_employee_performance(member["email"], ws_id)

            name = html.escape(member_stats.get("name", member["email"]))
            assigned = int(member_stats.get("assigned", 0))
            completed = int(member_stats.get("completed", 0))
            completion_rate = int(member_stats.get("completion_rate", 0))
            avg_days = member_stats.get("avg_completion_time_days", 0)

            render_html(
                f"""
<div class="ds-proj-card">
  <div class="ds-proj-top">
    <div class="ds-proj-title" style="font-size:1rem;">{name}</div>
    <span class="ds-badge ds-badge-accent">Completion: {completion_rate}%</span>
  </div>
  <div class="ds-proj-meta" style="margin-top:10px;">
    <span>Assigned: {assigned}</span>
    <span>Completed: {completed}</span>
    <span>Avg completion: {avg_days}d</span>
  </div>
</div>
"""
            )
    else:
        st.info("Only workspace admins or owners can view team performance.")

# ------------------------------------------------------------
# Footer
# ------------------------------------------------------------
st.markdown("---")
st.markdown(
    """
<div style="text-align:center; color: rgba(255,255,255,0.65); padding: 6px 0 10px;">
  <div style="font-size: 0.9rem;">DreamShift EMS © 2026</div>
</div>
""",
    unsafe_allow_html=True,
)
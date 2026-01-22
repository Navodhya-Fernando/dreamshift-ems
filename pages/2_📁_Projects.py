import streamlit as st
import datetime
import html
from bson import ObjectId
from src.database import DreamShiftDB

# Page config
st.set_page_config(page_title="Projects | DreamShift EMS", page_icon="static/icons/projects.svg", layout="wide", initial_sidebar_state="expanded")

# Load custom CSS and setup
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

# Hide default sidebar navigation and show custom sidebar
hide_streamlit_sidebar()
render_custom_sidebar()

# Load global CSS
load_global_css()

# Helpers
def render_html(html_str: str):
    """Strip leading whitespace so Streamlit does not treat it as code."""
    cleaned = "\n".join([line.lstrip() for line in html_str.split("\n")])
    st.markdown(cleaned, unsafe_allow_html=True)

# App
# ------------------------------------------------------------
db = DreamShiftDB()

# Auth check
if "user_email" not in st.session_state:
    st.error("Please login on the Home page first.")
    st.stop()

if "current_ws_id" not in st.session_state:
    st.warning("Please select a workspace first.")
    st.stop()

ws_id = st.session_state.current_ws_id
user_role = st.session_state.get('user_role', 'Employee')
user_email = st.session_state.user_email
ws_name = st.session_state.get('current_ws_name', 'Workspace')

# ------------------------------------------------------------
# Header
# ------------------------------------------------------------
render_html("""
<div class="ds-page-head">
  <div>
    <h1 class="ds-page-title">Projects</h1>
    <p class="ds-page-sub">Manage your workspace projects</p>
  </div>
</div>
""")

# ------------------------------------------------------------
# Stats
# ------------------------------------------------------------
stats = db.get_workspace_stats(ws_id)

render_html(f"""
<div class="ds-metrics ds-metrics-4">
  <div class="ds-metric">
    <div class="ds-metric-label">Total Projects</div>
    <div class="ds-metric-value">{stats.get('total_projects', 0)}</div>
  </div>
  <div class="ds-metric">
    <div class="ds-metric-label">Active</div>
    <div class="ds-metric-value">{stats.get('active_projects', 0)}</div>
  </div>
  <div class="ds-metric">
    <div class="ds-metric-label">Total Tasks</div>
    <div class="ds-metric-value">{stats.get('total_tasks', 0)}</div>
  </div>
  <div class="ds-metric">
    <div class="ds-metric-label">Overdue</div>
    <div class="ds-metric-value ds-danger">{stats.get('overdue_tasks', 0)}</div>
  </div>
</div>
""")

st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

# ------------------------------------------------------------
# Get workspace projects (check if we have ANY content)
projects = db.get_projects(ws_id)
templates = db.get_task_templates(ws_id)

# Determine if we should show the full two-column layout
# Show it if user can create projects or if there are items
show_layout = user_role in ["Owner", "Workspace Admin"] or len(projects) > 0

# Initialize filter variables
search = ""
status_filter = "All"
sort_by = "Newest"

# RIGHT: Actions Panel (only if show_layout)
if show_layout:
    render_html("""
    <div class="ds-card">
      <div class="ds-card-title">Actions</div>
      <div class="ds-card-sub">Create projects and manage filters</div>
    </div>
    """)
    
    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
    
    # Filters
    render_html('<div class="ds-card">')
    render_html('<div class="ds-card-title">Filters</div>')
    
    search = st.text_input("Search", placeholder="Search projects...", label_visibility="collapsed")
    status_filter = st.selectbox("Status", ["All", "Active", "On Hold", "Completed", "Cancelled"], label_visibility="collapsed")
    sort_by = st.selectbox("Sort", ["Newest", "Oldest", "Deadline (soonest)", "Deadline (latest)", "Name (A-Z)"], label_visibility="collapsed")
    
    render_html("</div>")
    
    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
    
    # Create Project
    if user_role in ["Owner", "Workspace Admin"]:
        render_html('<div class="ds-card">')
        render_html('<div class="ds-card-title">Create Project</div>')
        render_html('<div class="ds-card-sub">Service/Package is optional. Templates can auto-create tasks.</div>')
        
        tpl_map = {"No template": None}
        for t in templates:
            tpl_map[t.get("name", "Untitled Template")] = str(t["_id"])
        
        with st.form("create_project_form", clear_on_submit=False):
            proj_name = st.text_input("Project name", placeholder="e.g., CV Writing - Shane")
            proj_desc = st.text_area("Description (optional)", placeholder="Short overview, goals, notes...")
            proj_service = st.text_input("Service/Package (optional)", placeholder="Leave blank if not needed")
            
            col_a, col_b = st.columns(2)
            with col_a:
                deadline_enabled = st.checkbox("Set a deadline", value=True)
            with col_b:
                proj_status = st.selectbox("Status", ["Active", "On Hold", "Completed", "Cancelled"], index=0)
            
            proj_deadline = None
            if deadline_enabled:
                d = st.date_input("Deadline", min_value=datetime.date.today())
                proj_deadline = datetime.datetime.combine(d, datetime.time())
            
            selected_tpl_name = st.selectbox("Task template", list(tpl_map.keys()), index=0)
            selected_tpl_id = tpl_map[selected_tpl_name]
            
            # Create Project button (horizontal, never wraps)
            col_btn, col_spacer = st.columns([1, 8])
            with col_btn:
                submitted = st.form_submit_button("Create Project")
            
            if submitted:
                if not proj_name.strip():
                    st.error("Project name is required.")
                else:
                    project_id = db.create_project(
                        workspace_id=ws_id,
                        name=proj_name.strip(),
                        description=proj_desc.strip(),
                        service=(proj_service.strip() if proj_service.strip() else None),
                        deadline=proj_deadline,
                        status=proj_status,
                        created_by=user_email,
                        template_id=(selected_tpl_id if selected_tpl_id else None),
                        template_name=(selected_tpl_name if selected_tpl_id else None),
                    )
                
                # Apply template tasks
                if selected_tpl_id:
                    db.apply_template_to_project(
                        workspace_id=ws_id,
                        project_id=str(project_id),
                        template_id=selected_tpl_id,
                        created_by=user_email,
                    )
                
                st.success("Project created successfully.")
                st.rerun()
    
    render_html("</div>")
    
    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
    # Manage Templates button (horizontal, never wraps)
    col_btn, col_spacer = st.columns([1, 8])
    with col_btn:
        if st.button("🎯 Manage Task Templates", type="secondary"):
            st.switch_page("pages/task_templates.py")
    
    # Show message if user cannot create projects
    if user_role not in ["Owner", "Workspace Admin"]:
        render_html("""
        <div class="ds-card">
          <div class="ds-card-title">Create Project</div>
          <div class="ds-card-sub">Only Owners or Workspace Admins can create projects.</div>
        </div>
        """)

# ------------------------------------------------------------
# LEFT: Projects List
# ------------------------------------------------------------
render_html("""
<div class="ds-card">
  <div class="ds-card-title">All Projects</div>
  <div class="ds-card-sub">Click a project to view details and tasks</div>
</div>
""")

st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

# Projects grid
projects = db.get_projects(ws_id)

# Apply filters
if status_filter != "All":
    projects = [p for p in projects if p.get("status") == status_filter]

if search:
    s = search.lower().strip()
    def hit(p):
        return (s in (p.get("name", "").lower())
                or s in (p.get("description", "").lower())
                or s in (p.get("service", "") or "").lower())
    projects = [p for p in projects if hit(p)]

# Sorting
def safe_dt(x):
    return x if isinstance(x, datetime.datetime) else None

if sort_by == "Newest":
    projects = sorted(projects, key=lambda x: safe_dt(x.get("created_at")) or datetime.datetime.min, reverse=True)
elif sort_by == "Oldest":
    projects = sorted(projects, key=lambda x: safe_dt(x.get("created_at")) or datetime.datetime.max)
elif sort_by == "Deadline (soonest)":
    projects = sorted(projects, key=lambda x: safe_dt(x.get("deadline")) or datetime.datetime.max)
elif sort_by == "Deadline (latest)":
    projects = sorted(projects, key=lambda x: safe_dt(x.get("deadline")) or datetime.datetime.min, reverse=True)
elif sort_by == "Name (A-Z)":
    projects = sorted(projects, key=lambda x: (x.get("name") or "").lower())

if not projects:
    # Empty state
    render_html("""
    <div class="ds-empty-state">
      <div class="ds-empty-state-icon">📁</div>
      <div class="ds-empty-state-title">No projects found</div>
      <div class="ds-empty-state-sub">Adjust filters or create a new project.</div>
    </div>
    """)
else:
    # Grid cards
    grid_cols = st.columns(2, gap="large")
    
    for idx, project in enumerate(projects):
        col = grid_cols[idx % 2]
        
        with col:
            proj_id = str(project["_id"])
            proj_stats = db.get_project_stats(proj_id)
            
            status = project.get("status", "Active")
            badge_cls = {
                "Active": "ds-badge-ok",
                "On Hold": "ds-badge-warn",
                "Completed": "ds-badge-ok",
                "Cancelled": "ds-badge-danger",
            }.get(status, "ds-badge")
            
            name = html.escape(project.get("name", "Untitled"))
            desc = project.get("description", "") or ""
            desc_preview = (desc[:140] + "...") if len(desc) > 140 else desc
            desc_preview = html.escape(desc_preview) if desc_preview else "No description"
            
            service = project.get("service")
            deadline = project.get("deadline")
            deadline_str = deadline.strftime("%b %d, %Y") if isinstance(deadline, datetime.datetime) else "No deadline"
            
            template_name = project.get("template_name")
            
            completed = proj_stats.get("completed_tasks", 0)
            total = proj_stats.get("total_tasks", 0)
            pct = int(proj_stats.get("completion_percentage", 0))
            
            render_html(f"""
            <div class="ds-card ds-project-card">
              <div class="ds-project-top">
                <div>
                  <div class="ds-project-title">{name}</div>
                  <div class="ds-project-desc">{desc_preview}</div>
                </div>
                <div class="ds-badge {badge_cls}">{html.escape(status)}</div>
              </div>

              <div class="ds-project-meta">
                <div class="ds-project-meta-item">
                  <div class="ds-project-meta-label">Deadline</div>
                  <div class="ds-project-meta-value">{html.escape(deadline_str)}</div>
                </div>
                <div class="ds-project-meta-item">
                  <div class="ds-project-meta-label">Tasks</div>
                  <div class="ds-project-meta-value">{completed}/{total}</div>
                </div>
                <div class="ds-project-meta-item">
                  <div class="ds-project-meta-label">Progress</div>
                  <div class="ds-project-meta-value">{pct}%</div>
                </div>
              </div>

              <div class="ds-progress"><div style="width:{pct}%;"></div></div>

              <div class="ds-project-tags">
                {"<span class='ds-pill ds-pill-accent'>Template: " + html.escape(template_name) + "</span>" if template_name else ""}
                {"<span class='ds-pill'>Service: " + html.escape(service) + "</span>" if service else ""}
              </div>
            </div>
            """)
            # Place the button directly below the card, right-aligned, with compact width
            st.markdown("""
            <div style='text-align:right; margin-top:-18px; margin-bottom:18px;' class='ds-btn-compact'>
            """, unsafe_allow_html=True)
            if st.button("View Details", key=f"view_{proj_id}"):
                st.session_state.selected_project_id = proj_id
                st.switch_page("pages/project_details.py")
            st.markdown("</div>", unsafe_allow_html=True)
# ------------------------------------------------------------
# Footer
# ------------------------------------------------------------
st.markdown("---")
render_html("""
<div class="ds-footer">
  DreamShift EMS © 2026
</div>
""")
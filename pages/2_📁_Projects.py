import streamlit as st
from src.database import DreamShiftDB
import datetime
import html

# Page config
st.set_page_config(
    page_title="Projects | DreamShift EMS", 
    page_icon="static/icons/projects.svg", 
    layout="wide", 
    initial_sidebar_state="expanded"
)

# Import UI utilities
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

# Hide default sidebar navigation and show custom sidebar
hide_streamlit_sidebar()
render_custom_sidebar()

# Load global CSS
load_global_css()

db = DreamShiftDB()

# --- Auth Check ---
if "user_email" not in st.session_state:
    st.switch_page("pages/0_🚪_Sign_In.py")

user_email = st.session_state.user_email
ws_id = st.session_state.get("current_ws_id")

if not ws_id:
    st.warning("Please select a workspace from the sidebar.")
    st.stop()

# --- HEADER ---
# Use custom SVG loader for sharp visuals
icon_html = get_svg("projects.svg", width=38, height=38) or ":material/folder_open:"

st.markdown(f"""
<div class="ds-page-head">
  <div>
    <h1 class="ds-page-title" style="display:flex; align-items:center; gap:12px;">
        {icon_html} Projects
    </h1>
    <p class="ds-page-sub">Manage timelines, deliverables, and team progress</p>
  </div>
</div>
""", unsafe_allow_html=True)

# --- METRICS OVERVIEW ---
projects = db.get_projects(ws_id)
active = len([p for p in projects if p.get('status') == 'Active'])
completed = len([p for p in projects if p.get('status') == 'Completed'])
on_hold = len([p for p in projects if p.get('status') == 'On Hold'])

# Render metrics using the consistent .ds-metric class
st.markdown(f"""
<div class="ds-metrics">
  <div class="ds-metric">
    <div class="ds-metric-label">Total Projects</div>
    <div class="ds-metric-value">{len(projects)}</div>
  </div>
  <div class="ds-metric">
    <div class="ds-metric-label">Active</div>
    <div class="ds-metric-value" style="color:#2fe37a;">{active}</div>
  </div>
  <div class="ds-metric">
    <div class="ds-metric-label">Completed</div>
    <div class="ds-metric-value">{completed}</div>
  </div>
  <div class="ds-metric">
    <div class="ds-metric-label">On Hold</div>
    <div class="ds-metric-value" style="color:#ffb020;">{on_hold}</div>
  </div>
</div>
""", unsafe_allow_html=True)

st.markdown("<div style='height:20px'></div>", unsafe_allow_html=True)

# --- MAIN LAYOUT (Left: List, Right: Actions) ---
col_list, col_actions = st.columns([2.5, 1])

with col_list:
    st.markdown("### Active Projects")
    
    if not projects:
        st.info("No projects found in this workspace.", icon=":material/folder_off:")
    else:
        # Sort: Active first, then by deadline
        projects.sort(key=lambda x: (x.get('status') == 'Completed', x.get('deadline') or datetime.datetime.max))

        for p in projects:
            p_id = str(p['_id'])
            name = html.escape(p['name'])
            desc = html.escape(p.get('description', 'No description'))
            status = p.get('status', 'Active')
            progress = int(p.get('completion_percentage', 0))
            
            # Deadline formatting
            deadline_dt = p.get('deadline')
            if deadline_dt:
                deadline_str = deadline_dt.strftime("%b %d")
            else:
                deadline_str = "No Date"

            # Status Badge Logic
            badge_class = "ds-badge-accent"
            if status == "Completed": badge_class = "ds-badge-ok"
            elif status == "On Hold": badge_class = "ds-badge-warn"
            
            # PROJECT CARD
            st.markdown(f"""
            <div class="ds-card" style="margin-bottom:12px; padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-size:1.1rem; font-weight:800; color:#fff;">{name}</div>
                        <div style="color:rgba(255,255,255,0.6); font-size:0.9rem; margin-top:4px;">{desc}</div>
                    </div>
                    <span class="ds-badge {badge_class}">{status}</span>
                </div>
                
                <div style="margin-top:16px; display:flex; justify-content:space-between; font-size:0.85rem; color:rgba(255,255,255,0.5);">
                    <span><b style="color:#fff;">{progress}%</b> Complete</span>
                    <span>Due: <b style="color:#fff;">{deadline_str}</b></span>
                </div>
                <div class="ds-progress" style="margin-top:8px;">
                    <div style="width:{progress}%;"></div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            # Action Buttons (View / Edit)
            # Using columns correctly to avoid "list" errors
            c1, c2 = st.columns([1, 4])
            with c1:
                if st.button("View Details", key=f"btn_{p_id}", use_container_width=True):
                    st.session_state.selected_project_id = p_id
                    st.switch_page("pages/project_details.py")
            
            st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)

with col_actions:
    # --- CREATE PROJECT PANEL ---
    st.markdown("### Actions")
    
    with st.container(border=True):
        st.markdown("**Create New Project**")
        st.caption("Launch a new initiative in this workspace.")
        
        with st.form("create_proj_form"):
            new_name = st.text_input("Project Name", placeholder="e.g. Website Redesign")
            new_desc = st.text_area("Description")
            new_deadline = st.date_input("Deadline", value=datetime.date.today() + datetime.timedelta(days=14))
            
            if st.form_submit_button("Create Project", type="primary", use_container_width=True):
                if new_name:
                    db.create_project(
                        workspace_id=ws_id,
                        name=new_name,
                        description=new_desc,
                        deadline=datetime.datetime.combine(new_deadline, datetime.time()),
                        status="Active",
                        created_by=user_email
                    )
                    st.success("Project created!")
                    st.rerun()
                else:
                    st.error("Name required.")

    st.markdown("<div style='height:20px'></div>", unsafe_allow_html=True)
    
    # --- FILTERS ---
    with st.expander("🔎 Filters & Sort", expanded=True):
        f_status = st.multiselect("Status", ["Active", "On Hold", "Completed"], default=["Active"])
        f_sort = st.selectbox("Sort By", ["Deadline (Soonest)", "Name (A-Z)", "Progress (High-Low)"])
        
        st.caption(f"Showing projects for: **{st.session_state.current_ws_name}**")
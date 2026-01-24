import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Projects", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

icon = get_svg("projects.svg", 36, 36) or ":material/folder:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Projects</h1></div>""", unsafe_allow_html=True)

# Fetch Workspaces for Dropdown
user_workspaces = db.get_user_workspaces(st.session_state.user_email)
ws_options = {w['name']: str(w['_id']) for w in user_workspaces}

# Default to current workspace if set
current_ws_id = st.session_state.get("current_ws_id")
default_ws_index = 0
if current_ws_id:
    # Find index of current_ws_id in values
    ws_ids = list(ws_options.values())
    if current_ws_id in ws_ids:
        default_ws_index = ws_ids.index(current_ws_id)

# --- BETTER PROJECT FORM ---
with st.expander("Create New Project", expanded=False):
    st.markdown("### Project Details")
    with st.form("new_proj_form"):
        col1, col2 = st.columns(2)
        
        with col1:
            name = st.text_input("Project Name", placeholder="e.g. Website Redesign")
            workspace_name = st.selectbox("Workspace", list(ws_options.keys()), index=default_ws_index)
        
        with col2:
            due_date = st.date_input("Due Date", value=datetime.date.today() + datetime.timedelta(days=30))
            # Placeholder for Task Templates - fetch real ones if implemented
            task_template = st.selectbox("Task Template", ["None", "Software Dev", "Marketing Campaign", "Onboarding"])

        desc = st.text_area("Description (Optional)", placeholder="What is this project about?", height=100)
        
        if st.form_submit_button("Create Project", use_container_width=True, type="primary"):
            if not name:
                st.error("Project Name is required.")
            else:
                selected_ws_id = ws_options[workspace_name]
                
                # Create Project
                proj_data = {
                    "workspace_id": selected_ws_id,
                    "name": name,
                    "description": desc,
                    "deadline": datetime.datetime.combine(due_date, datetime.time()),
                    "template": task_template if task_template != "None" else None,
                    "created_by": st.session_state.user_email,
                    "created_at": datetime.datetime.utcnow(),
                    "status": "Active"
                }
                
                db.db.projects.insert_one(proj_data)
                
                # Switch context if needed
                st.session_state.current_ws_id = selected_ws_id
                st.success(f"Project '{name}' created successfully!")
                st.rerun()

# --- PROJECT GRID ---
# Filter by selected workspace
if current_ws_id:
    all_projects = list(db.db.projects.find({"workspace_id": current_ws_id}))
    status_options = sorted({p.get("status", "Active") for p in all_projects}) or ["Active"]
    f1, f2 = st.columns([2, 1])
    with f1:
        search_query = st.text_input("Search projects", placeholder="Search by project title")
    with f2:
        status_filter = st.multiselect("Filter by Status", status_options, default=status_options)

    projects = [p for p in all_projects if p.get("status", "Active") in status_filter]
    if search_query:
        q = search_query.strip().lower()
        projects = [p for p in projects if q in (p.get("name", "").lower())]
    
    if not projects:
        st.info("No projects found in this workspace.")
    
    cols = st.columns(3)
    for idx, p in enumerate(projects):
        with cols[idx % 3]:
            # Calculate Progress
            p_tasks = list(db.db.tasks.find({"project_id": str(p['_id'])}))
            total = len(p_tasks)
            done = sum(1 for t in p_tasks if t['status'] == 'Completed')
            progress = done / total if total > 0 else 0
            deadline = p.get('deadline')
            
            st.markdown(f"""
            <div class="ds-card" style="height: 220px; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <h3 style="margin:0; color:#f6b900;">{p['name']}</h3>
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px; font-size:0.75rem; color:#cfcfcf;">
                        <span class="ds-status ds-status--{p.get('status','Active').lower().replace(' ','-')}">{p.get('status','Active')}</span>
                        <span class="ds-meta-item">Deadline: {deadline.strftime('%b %d') if deadline else '—'}</span>
                    </div>
                    <p style="color:#b0b3b8; font-size:0.85rem; margin-top:10px; line-height:1.4;">
                        {p.get('description','No description')[:80]}...
                    </p>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:5px; color:#fff;">
                        <span>{int(progress*100)}% Complete</span>
                        <span>{len(p_tasks)} Tasks</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.1); height:6px; border-radius:3px; width:100%;">
                        <div style="background:#f6b900; height:6px; border-radius:3px; width:{int(progress*100)}%;"></div>
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            # Invisible button covering the card for interaction
            if st.button(f"Open {p['name']}", key=str(p['_id']), use_container_width=True):
                st.session_state.selected_project_id = str(p['_id'])
                st.switch_page("pages/project-details.py")
else:
    st.warning("Please select a workspace from the sidebar.")

import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Projects", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

icon = get_svg("projects.svg", 36, 36) or ":material/folder:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Projects</h1></div>""", unsafe_allow_html=True)

ws_id = st.session_state.get("current_ws_id")

# --- CREATE PROJECT ---
with st.expander("➕ Create New Project"):
    with st.form("new_proj"):
        name = st.text_input("Project Name")
        desc = st.text_area("Description")
        if st.form_submit_button("Create Project"):
            db.db.projects.insert_one({
                "workspace_id": ws_id,
                "name": name,
                "description": desc,
                "created_by": st.session_state.user_email
            })
            st.success("Project created!")
            st.rerun()

# --- PROJECT GRID ---
projects = list(db.db.projects.find({"workspace_id": ws_id}))
if not projects:
    st.info("No projects yet.")

# Display in rows of 3
cols = st.columns(3)
for idx, p in enumerate(projects):
    with cols[idx % 3]:
        # Calculate Progress
        p_tasks = list(db.db.tasks.find({"project_id": str(p['_id'])}))
        total = len(p_tasks)
        done = sum(1 for t in p_tasks if t['status'] == 'Completed')
        progress = done / total if total > 0 else 0
        
        st.markdown(f"""
        <div class="ds-card" style="height: 200px; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
                <h3>{p['name']}</h3>
                <p style="color:#888; font-size:0.9rem;">{p.get('description','No desc')[:50]}...</p>
            </div>
            <div>
                <div style="font-size:0.8rem; margin-bottom:5px;">Progress: {int(progress*100)}%</div>
                <div style="background:#333; height:6px; border-radius:3px; width:100%;">
                    <div style="background:#f6b900; height:6px; border-radius:3px; width:{int(progress*100)}%;"></div>
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        if st.button(f"Open {p['name']}", key=str(p['_id']), use_container_width=True):
            st.session_state.selected_project_id = str(p['_id'])
            st.switch_page("pages/project-details.py")
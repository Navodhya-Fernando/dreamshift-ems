import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Workspaces", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

ws_id = st.session_state.get("current_ws_id")
icon = get_svg("workspaces.svg", 36, 36) or ":material/domain:"

st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Workspaces</h1></div>""", unsafe_allow_html=True)

# Workspace Selector logic if None selected
if not ws_id:
    workspaces = db.get_user_workspaces(st.session_state.user_email)
    if not workspaces:
        st.info("No workspaces found. Create one!")
        with st.form("create_ws"):
            name = st.text_input("Workspace Name")
            if st.form_submit_button("Create New Workspace"):
                new_id = db.create_workspace(name, st.session_state.user_email)
                st.session_state.current_ws_id = str(new_id)
                st.rerun()
        st.stop()
    else:
        st.warning("Please select a workspace from the sidebar.")
        st.stop()

# --- TABBED VIEW ---
tab1, tab2 = st.tabs(["👥 Team Members", "⚙️ Settings"])

with tab1:
    ws = db.db.workspaces.find_one({"_id": db.ObjectId(ws_id)})
    members = ws.get('members', [])
    
    # Add Member Form
    with st.form("add_member"):
        c1, c2, c3 = st.columns([3, 1, 1])
        new_email = c1.text_input("Email Address")
        role = c2.selectbox("Role", ["Admin", "Employee", "Viewer"])
        if c3.form_submit_button("Add Member", use_container_width=True):
            success, msg = db.add_workspace_member(ws_id, new_email, role)
            if success: st.success("Member added!")
            else: st.error(msg)
            st.rerun()
            
    # List Members
    st.markdown("### Current Team")
    for m in members:
        col1, col2, col3 = st.columns([3, 1, 1])
        col1.write(f"**{m['email']}**")
        col2.caption(m['role'])
        if col3.button("Remove", key=f"rm_{m['email']}"):
            db.remove_workspace_member(ws_id, m['email'])
            st.rerun()

with tab2:
    st.subheader("Workflow Customization")
    current = db.get_workspace_statuses(ws_id)
    
    with st.form("status_edit"):
        st.write("Define your columns (comma separated):")
        new = st.text_input("Statuses", value=",".join(current))
        if st.form_submit_button("Update Workflow"):
            statuses = [s.strip() for s in new.split(",") if s.strip()]
            db.update_workspace_statuses(ws_id, statuses)
            st.success("Workflow updated!")
            st.rerun()
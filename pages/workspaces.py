import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Workspaces", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
render_custom_sidebar()

db = DreamShiftDB()
ws_id = st.session_state.get("current_ws_id")
icon = get_svg("workspaces.svg", 36, 36) or ":material/domain:"

st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Workspaces</h1></div>""", unsafe_allow_html=True)

if not ws_id: st.warning("Select a workspace."); st.stop()

tab1, tab2 = st.tabs(["Team", "Workflow Settings"])

with tab1:
    st.write("Team management (Add/Remove members)")
    # (Insert your team management logic here)

with tab2:
    st.subheader("Custom Statuses")
    current = db.get_workspace_statuses(ws_id)
    st.write(f"Current: {', '.join(current)}")
    
    with st.form("status_edit"):
        new = st.text_input("Statuses (comma separated)", value=",".join(current))
        if st.form_submit_button("Update Workflow"):
            db.update_workspace_statuses(ws_id, [s.strip() for s in new.split(",") if s.strip()])
            st.success("Updated!")
            st.rerun()
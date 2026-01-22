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

projects = db.db.projects.find({"workspace_id": st.session_state.get("current_ws_id")})
for p in projects:
    st.markdown(f"""
    <div class="ds-card">
        <h3>{p['name']}</h3>
        <p>{p.get('description','No desc')}</p>
    </div>
    """, unsafe_allow_html=True)
    if st.button(f"Open {p['name']}", key=str(p['_id'])):
        st.session_state.selected_project_id = str(p['_id'])
        st.switch_page("pages/project-details.py")
import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

st.set_page_config(page_title="Project Details", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

pid = st.session_state.get("selected_project_id")
if not pid: st.stop()

if st.button("← Back"): st.switch_page("pages/projects.py")
proj = db.db.projects.find_one({"_id": db.ObjectId(pid)})

st.markdown(f"""<div class="ds-card"><h1>{proj['name']}</h1><p>{proj.get('description')}</p></div>""", unsafe_allow_html=True)
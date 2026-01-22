import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Templates", page_icon="static/icons/templates.svg", layout="wide")
hide_streamlit_sidebar()
render_custom_sidebar()
load_global_css()

db = DreamShiftDB()
ws_id = st.session_state.get("current_ws_id")

icon_html = get_svg("templates.svg", 36, 36) or ":material/extension:"
st.markdown(f"""<div class="ds-page-head"><h1 class="ds-page-title" style="display:flex;align-items:center;gap:12px;">{icon_html} Templates</h1></div>""", unsafe_allow_html=True)

col_list, col_edit = st.columns([1, 2])
with col_list:
    templates = db.get_task_templates(ws_id)
    if st.button("New Template"):
        st.session_state.selected_template = None
        st.rerun()
    for t in templates:
        if st.button(t['name'], key=str(t['_id'])):
            st.session_state.selected_template = str(t['_id'])
            st.rerun()

with col_edit:
    if st.session_state.get("selected_template"):
        st.write("Edit Template (Implementation Placeholder)")
    else:
        st.write("Create New Template")
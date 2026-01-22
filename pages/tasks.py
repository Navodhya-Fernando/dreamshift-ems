import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Tasks", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

icon = get_svg("tasks.svg", 36, 36) or ":material/check_circle:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Tasks</h1></div>""", unsafe_allow_html=True)

ws_id = st.session_state.get("current_ws_id")
if not ws_id: st.stop()

# Status Filter
statuses = db.get_workspace_statuses(ws_id)
filter_status = st.selectbox("Filter Status", ["All"] + statuses)

query = {"workspace_id": ws_id}
if filter_status != "All": query["status"] = filter_status

tasks = list(db.db.tasks.find(query))
for t in tasks:
    st.markdown(f"""
    <div class="ds-card" style="padding:15px; border-left:4px solid #f6b900;">
        <div style="font-weight:bold;">{t['title']}</div>
        <div class="ds-badge">{t['status']}</div>
    </div>
    """, unsafe_allow_html=True)
    if st.button("Details", key=str(t['_id'])):
        st.session_state.selected_task_id = str(t['_id'])
        st.switch_page("pages/task-details.py")
import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg
from components.calendar import render_month_view, group_tasks_by_date

st.set_page_config(page_title="Calendar", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

icon = get_svg("calendar.svg", 36, 36) or ":material/calendar_month:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Calendar</h1></div>""", unsafe_allow_html=True)

# Controls
c1, c2 = st.columns([1, 4])
view_date = st.session_state.get('calendar_view_date', datetime.date.today())
with c1:
    # Simple nav
    if st.button("Previous Month"):
        st.session_state.calendar_view_date = view_date.replace(day=1) - datetime.timedelta(days=1)
        st.rerun()
with c2:
    if st.button("Next Month"):
        # Logic to advance month
        next_month = view_date.replace(day=28) + datetime.timedelta(days=4)
        st.session_state.calendar_view_date = next_month.replace(day=1)
        st.rerun()

st.markdown(f"### {view_date.strftime('%B %Y')}")

# Fetch Tasks
tasks = db.get_tasks_with_urgency({"workspace_id": st.session_state.get("current_ws_id")})
tasks_by_date = group_tasks_by_date(tasks)

# Render Grid
render_month_view(view_date.year, view_date.month, tasks_by_date, color_mode="Priority")
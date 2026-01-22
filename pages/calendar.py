import streamlit as st
import datetime

from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg
from components.calendar import render_month_view, group_tasks_by_date

st.set_page_config(page_title="Calendar", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

db = DreamShiftDB()

# Auth guard
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

# Header (SVG only)
icon = get_svg("calendar.svg", 28, 28)
st.markdown(
    f"""
    <div class="ds-page-head">
        <div class="ds-page-head-left">
            <div class="ds-page-icon">{icon}</div>
            <div class="ds-page-titles">
                <div class="ds-page-title">Calendar</div>
                <div class="ds-page-subtitle">See upcoming tasks and due dates across the workspace.</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

ws_id = st.session_state.get("current_ws_id")
if not ws_id:
    st.markdown("<div class='ds-empty-mini'>Select a workspace from the sidebar to view the calendar.</div>", unsafe_allow_html=True)
    st.stop()

# -----------------------------
# State
# -----------------------------
today = datetime.date.today()
view_date = st.session_state.get("calendar_view_date", today)
if not isinstance(view_date, datetime.date):
    view_date = today

# Helpers
def prev_month(d: datetime.date) -> datetime.date:
    first = d.replace(day=1)
    return (first - datetime.timedelta(days=1)).replace(day=1)

def next_month(d: datetime.date) -> datetime.date:
    nm = d.replace(day=28) + datetime.timedelta(days=4)
    return nm.replace(day=1)

# -----------------------------
# Controls row (clean + compact)
# -----------------------------
c1, c2, c3, c4 = st.columns([1.2, 1.2, 3.6, 1.4])

with c1:
    if st.button("Previous", use_container_width=True, type="secondary"):
        st.session_state.calendar_view_date = prev_month(view_date)
        st.rerun()

with c2:
    if st.button("Next", use_container_width=True, type="secondary"):
        st.session_state.calendar_view_date = next_month(view_date)
        st.rerun()

with c3:
    st.markdown(
        f"<div class='ds-calendar-title'>{view_date.strftime('%B %Y')}</div>",
        unsafe_allow_html=True,
    )

with c4:
    if st.button("Today", use_container_width=True, type="primary"):
        st.session_state.calendar_view_date = today.replace(day=1)
        st.rerun()

st.markdown("<div class='ds-divider'></div>", unsafe_allow_html=True)

# -----------------------------
# Fetch tasks
# -----------------------------
tasks = db.get_tasks_with_urgency({"workspace_id": ws_id}) or []
tasks_by_date = group_tasks_by_date(tasks)

# -----------------------------
# Calendar grid
# -----------------------------
st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
st.markdown("<div class='ds-card-title'>Month view</div>", unsafe_allow_html=True)
st.markdown("<div class='ds-card-subtitle'>Color mode: Priority</div>", unsafe_allow_html=True)

render_month_view(view_date.year, view_date.month, tasks_by_date, color_mode="Priority")

st.markdown("</div>", unsafe_allow_html=True)

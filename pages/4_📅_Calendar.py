import calendar
import datetime
import html
import os
import streamlit as st
from src.database import DreamShiftDB
from src.calendar_sync import authorize_gcal, sync_all_tasks_to_gcal

st.set_page_config(
    page_title="Calendar | DreamShift",
    page_icon="static/icons/calendar.svg",
    layout="wide",
    initial_sidebar_state="expanded",
)

from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

hide_streamlit_sidebar()
render_custom_sidebar()
load_global_css()

db = DreamShiftDB()

if "user_email" not in st.session_state:
    st.switch_page("pages/0_🚪_Sign_In.py")

if "cal_date" not in st.session_state:
    st.session_state.cal_date = datetime.date.today()

# --- HEADER ---
c1, c2 = st.columns([3, 1])
with c1:
    st.markdown(
        """
        <div class="ds-page-head">
          <h1 class="ds-page-title" style="display:flex; align-items:center; gap:10px;">
            :material/calendar_month: Calendar
          </h1>
          <p class="ds-page-sub">Visualize deadlines and sync with Google Calendar</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

with c2:
    st.markdown("<div style='text-align:right; padding-top:10px;'>", unsafe_allow_html=True)
    if st.button(":material/sync: Sync to Google Calendar", use_container_width=True):
        creds = authorize_gcal()
        if creds:
            synced = sync_all_tasks_to_gcal(db, st.session_state.user_email, creds)
            st.toast(f"Synced {synced} tasks", icon=":material/event_available:")
        else:
            st.error("Google authorization failed")
    st.markdown("</div>", unsafe_allow_html=True)

# --- CALENDAR CONTROLS ---
nav_col, _ = st.columns([2, 5])
with nav_col:
    current = st.session_state.cal_date
    jump_date = st.date_input("Jump to date", value=current, label_visibility="collapsed")
    st.session_state.cal_date = jump_date

start_date = st.session_state.cal_date.replace(day=1)
_, last_day = calendar.monthrange(start_date.year, start_date.month)
end_date = start_date.replace(day=last_day)

workspace_id = st.session_state.get("current_ws_id")
query = {
    "assignee": st.session_state.user_email,
    "due_date": {
        "$gte": datetime.datetime.combine(start_date, datetime.time.min),
        "$lte": datetime.datetime.combine(end_date, datetime.time.max),
    },
}
if workspace_id:
    query["workspace_id"] = workspace_id

tasks = db.get_tasks_with_urgency(query) or []
tasks_by_day = {}
for task in tasks:
    due_date = task.get("due_date")
    if not isinstance(due_date, datetime.datetime):
        continue
    if due_date.date().month != start_date.month or due_date.date().year != start_date.year:
        continue
    day_key = due_date.day
    tasks_by_day.setdefault(day_key, []).append(task)

# --- MONTH GRID ---
st.markdown(f"### {start_date.strftime('%B %Y')}")

weekday_cols = st.columns(7)
for idx, day in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]):
    weekday_cols[idx].markdown(
        f"<div style='text-align:center; font-weight:bold; color:rgba(255,255,255,0.6); margin-bottom:10px;'>{day}</div>",
        unsafe_allow_html=True,
    )

month_matrix = calendar.monthcalendar(start_date.year, start_date.month)
for week in month_matrix:
    cols = st.columns(7)
    for idx, day_num in enumerate(week):
        with cols[idx]:
            if day_num == 0:
                st.markdown(
                    "<div style='height:100px; background:rgba(255,255,255,0.02); border-radius:8px; margin-bottom:10px;'></div>",
                    unsafe_allow_html=True,
                )
                continue

            day_tasks = tasks_by_day.get(day_num, [])
            dots = ""
            for task in day_tasks[:3]:
                color = html.escape(task.get("urgency_color", "#666"))
                dots += f"<div style='width:6px; height:6px; border-radius:50%; background:{color}; display:inline-block; margin-right:2px;'></div>"

            is_today = (
                day_num == datetime.date.today().day
                and start_date.month == datetime.date.today().month
                and start_date.year == datetime.date.today().year
            )
            border = "1px solid #f6b900" if is_today else "1px solid rgba(255,255,255,0.1)"
            bg = "rgba(246,185,0,0.1)" if is_today else "rgba(255,255,255,0.05)"
            text_color = "#f6b900" if is_today else "#fff"

            st.markdown(
                f"""
                <div style="height:100px; background:{bg}; border:{border}; border-radius:8px; padding:8px; margin-bottom:10px; position:relative;">
                    <div style="font-weight:bold; font-size:14px; color:{text_color}">{day_num}</div>
                    <div style="margin-top:6px;">{dots}</div>
                    <div style="font-size:10px; color:rgba(255,255,255,0.5); position:absolute; bottom:8px;">{len(day_tasks) if day_tasks else ''}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            if day_tasks:
                with st.popover(f"{len(day_tasks)} tasks", use_container_width=True):
                    for task in day_tasks:
                        st.write(f"**{task.get('title','')}**")
                        st.caption(f"{task.get('status','')} • {task.get('priority','')}")
                        task_id = str(task.get("_id"))
                        if st.button(":material/visibility: View", key=f"cal_view_{task_id}"):
                            st.session_state.selected_task_id = task_id
                            st.switch_page("pages/task_details.py")

# --- SIDEBAR SYNC INFO ---
st.markdown("---")
st.markdown("### :material/link: Calendar Sync")
with st.container(border=True):
    user = db.get_user(st.session_state.user_email)
    is_connected = user.get("preferences", {}).get("google_calendar_connected", False) if user else False
    outlook_connected = user.get("preferences", {}).get("outlook_connected", False) if user else False

    col_sync1, col_sync2 = st.columns(2)
    with col_sync1:
        st.write("**Google Calendar**")
        if is_connected:
            st.success("Connected")
            if st.button(":material/sync: Sync now", use_container_width=True):
                st.toast("Sync started", icon=":material/sync:")
            if st.button(":material/power_settings_new: Disconnect", use_container_width=True):
                db.update_user_profile(st.session_state.user_email, {"preferences.google_calendar_connected": False})
                st.rerun()
        else:
            if st.button(":material/link: Connect Google", use_container_width=True):
                try:
                    from src.calendar_sync import GoogleCalendarSync

                    gc = GoogleCalendarSync()
                    auth_url, state = gc.get_authorization_url()
                    st.session_state.google_oauth_state = state
                    st.markdown(
                        f"[Authorize Google Calendar]({auth_url})",
                        unsafe_allow_html=True,
                    )
                    st.info("After authorization, return to DreamShift to finish setup.")
                except Exception as exc:
                    st.error(f"Google Calendar setup error: {exc}")

    with col_sync2:
        st.write("**iCal Feed**")
        base_url = os.getenv("APP_BASE_URL", "http://localhost:8501")
        feed_url = f"{base_url}/api/ical/{st.session_state.user_email}" if user else ""
        st.code(feed_url or "Set after login", language="text")
        st.caption("Copy into Apple Calendar, Outlook, Google Calendar, or any iCal app")
        if outlook_connected:
            st.success("Outlook connected")
        else:
            st.caption("Outlook integration coming soon")

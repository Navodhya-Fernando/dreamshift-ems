import calendar
import datetime
import html
import os
import streamlit as st
from src.database import DreamShiftDB

# Page config
st.set_page_config(
    page_title="Calendar | DreamShift",
    page_icon="static/icons/calendar.svg",
    layout="wide",
)

# Import UI
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

# Load Global CSS & Sidebar
hide_streamlit_sidebar()
render_custom_sidebar()
load_global_css()

db = DreamShiftDB()

if "user_email" not in st.session_state:
    st.switch_page("pages/0_🚪_Sign_In.py")

if "cal_date" not in st.session_state:
    st.session_state.cal_date = datetime.date.today()

# --- HEADER & ACTIONS ---
icon_html = get_svg("calendar.svg", width=38, height=38) or ":material/calendar_month:"

c1, c2 = st.columns([3, 1])
with c1:
    st.markdown(f"""
    <div class="ds-page-head">
      <div>
        <h1 class="ds-page-title" style="display:flex; align-items:center; gap:12px;">
            {icon_html} Calendar
        </h1>
        <p class="ds-page-sub">Visualize deadlines and sync with external calendars</p>
      </div>
    </div>
    """, unsafe_allow_html=True)

with c2:
    # Try importing sync functions safely
    try:
        from src.calendar_sync import authorize_gcal, sync_all_tasks_to_gcal
        
        if st.button("🔄 Sync with Google", use_container_width=True):
            if not os.path.exists('credentials.json'):
                st.error("Missing 'credentials.json'. Cannot sync.")
            else:
                creds = authorize_gcal()
                if creds:
                    with st.spinner("Syncing tasks..."):
                        count = sync_all_tasks_to_gcal(db, st.session_state.user_email, creds)
                    st.success(f"Synced {count} tasks!", icon="✅")
                else:
                    st.error("Google Auth failed.")
    except ImportError:
        st.warning("Sync module not available.")

# --- CALENDAR VIEW ---
st.markdown("---")

# Navigation
col_nav, col_view = st.columns([2, 5])
with col_nav:
    new_date = st.date_input("Jump to date", value=st.session_state.cal_date, label_visibility="collapsed")
    st.session_state.cal_date = new_date

# Date calculations
start_date = st.session_state.cal_date.replace(day=1)
_, last_day = calendar.monthrange(start_date.year, start_date.month)
end_date = start_date.replace(day=last_day)

# Fetch tasks
query = {
    "assignee": st.session_state.user_email,
    "due_date": {
        "$gte": datetime.datetime.combine(start_date, datetime.time.min),
        "$lte": datetime.datetime.combine(end_date, datetime.time.max),
    },
    "status": {"$ne": "Completed"} # Optional: Hide completed
}
tasks = db.get_tasks_with_urgency(query)

# Map tasks to days
tasks_by_day = {}
if tasks:
    for task in tasks:
        if isinstance(task.get('due_date'), datetime.datetime):
            d = task['due_date'].day
            tasks_by_day.setdefault(d, []).append(task)

st.markdown(f"### {start_date.strftime('%B %Y')}")

# Weekday Header
cols = st.columns(7)
for i, day in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]):
    cols[i].markdown(f"<div style='text-align:center; opacity:0.6; font-size:13px; margin-bottom:10px;'>{day}</div>", unsafe_allow_html=True)

# Calendar Grid
month_matrix = calendar.monthcalendar(start_date.year, start_date.month)
for week in month_matrix:
    cols = st.columns(7)
    for i, day_num in enumerate(week):
        with cols[i]:
            if day_num == 0:
                st.markdown("<div style='height:110px; background:rgba(255,255,255,0.02); border-radius:12px; margin-bottom:10px;'></div>", unsafe_allow_html=True)
                continue

            day_tasks = tasks_by_day.get(day_num, [])
            is_today = (day_num == datetime.date.today().day and start_date.month == datetime.date.today().month)
            
            # Styles
            border_color = "#f6b900" if is_today else "rgba(255,255,255,0.1)"
            bg_color = "rgba(246,185,0,0.08)" if is_today else "rgba(255,255,255,0.05)"
            text_color = "#f6b900" if is_today else "#fff"
            
            # Dots for tasks
            dots_html = ""
            for t in day_tasks[:4]:
                color = t.get('urgency_color', '#666')
                dots_html += f"<div style='width:6px; height:6px; background:{color}; border-radius:50%; display:inline-block; margin-right:3px;'></div>"
            
            st.markdown(f"""
            <div class="ds-card" style="height:110px; padding:10px; background:{bg_color}; border:1px solid {border_color}; margin-bottom:10px; position:relative;">
                <div style="font-weight:bold; font-size:14px; color:{text_color};">{day_num}</div>
                <div style="margin-top:8px;">{dots_html}</div>
                <div style="position:absolute; bottom:8px; right:10px; font-size:10px; opacity:0.5;">
                    {len(day_tasks) if day_tasks else ''}
                </div>
            </div>
            """, unsafe_allow_html=True)

            # Popover for details
            if day_tasks:
                with st.popover(f"{len(day_tasks)} Tasks", use_container_width=True):
                    for t in day_tasks:
                        st.caption(f"{t.get('priority')} • {t.get('status')}")
                        if st.button(t['title'], key=f"cal_t_{t['_id']}"):
                            st.session_state.selected_task_id = str(t['_id'])
                            st.switch_page("pages/task_details.py")

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

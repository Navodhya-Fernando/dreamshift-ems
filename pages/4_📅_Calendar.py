import streamlit as st
from src.database import DreamShiftDB
import datetime

# Import calendar components
from components.calendar import (
    group_tasks_by_date,
    calendar_shell_start,
    calendar_shell_end,
    calendar_header,
    render_month_view,
    render_week_view,
    get_week_range
)

st.set_page_config(page_title="📅 Calendar", page_icon="📅", layout="wide")

# Load custom CSS
with open('static/styles.css') as f:
    st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)

db = DreamShiftDB()

# Check authentication
if "user_email" not in st.session_state:
    st.error("Please login first")
    st.stop()

# Initialize session state
if 'calendar_month' not in st.session_state:
    st.session_state.calendar_month = datetime.date.today().month
if 'calendar_year' not in st.session_state:
    st.session_state.calendar_year = datetime.date.today().year
if 'calendar_view' not in st.session_state:
    st.session_state.calendar_view = "Month"
if 'selected_calendar_date' not in st.session_state:
    st.session_state.selected_calendar_date = None
if 'calendar_color_mode' not in st.session_state:
    st.session_state.calendar_color_mode = "Priority"
if 'heatmap_enabled' not in st.session_state:
    st.session_state.heatmap_enabled = False

st.markdown("""
    <h1 style="color: #f6b900;">📅 Calendar & Task Schedule</h1>
    <p style="color: rgba(255, 255, 255, 0.7); margin-bottom: 30px;">View your tasks and deadlines in calendar format</p>
""", unsafe_allow_html=True)

# View options and controls
col1, col2, col3, col4 = st.columns([1.5, 1.5, 1, 1])

with col1:
    view = st.radio(
        "View Mode",
        ["Month", "Week"],
        horizontal=True,
        key="view_selector"
    )
    if view != st.session_state.calendar_view:
        st.session_state.calendar_view = view
        st.rerun()

with col2:
    color_mode = st.radio(
        "Color By",
        ["Priority", "Assignee"],
        horizontal=True,
        key="color_selector"
    )
    if color_mode != st.session_state.calendar_color_mode:
        st.session_state.calendar_color_mode = color_mode
        st.rerun()

with col3:
    if st.session_state.calendar_view == "Month":
        heatmap = st.checkbox(
            "Heatmap",
            value=st.session_state.heatmap_enabled,
            help="Show task density as background color"
        )
        if heatmap != st.session_state.heatmap_enabled:
            st.session_state.heatmap_enabled = heatmap
            st.rerun()

with col4:
    if st.button("Today", use_container_width=True):
        st.session_state.calendar_month = datetime.date.today().month
        st.session_state.calendar_year = datetime.date.today().year
        st.rerun()

st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

# Calendar navigation
col1, col2, col3 = st.columns([1, 2, 1])

with col1:
    if st.button("← Previous", use_container_width=True):
        if st.session_state.calendar_view == "Month":
            if st.session_state.calendar_month == 1:
                st.session_state.calendar_month = 12
                st.session_state.calendar_year -= 1
            else:
                st.session_state.calendar_month -= 1
        else:  # Week view
            current_date = datetime.date(st.session_state.calendar_year, st.session_state.calendar_month, 1)
            prev_week = current_date - datetime.timedelta(days=7)
            st.session_state.calendar_month = prev_week.month
            st.session_state.calendar_year = prev_week.year
        st.rerun()

with col2:
    current_date = datetime.date(st.session_state.calendar_year, st.session_state.calendar_month, 1)
    if st.session_state.calendar_view == "Month":
        calendar_header(current_date.strftime('%B %Y'))
    else:
        week_days = get_week_range(current_date)
        week_label = f"{week_days[0].strftime('%b %d')} - {week_days[-1].strftime('%b %d, %Y')}"
        calendar_header(week_label)

with col3:
    if st.button("Next →", use_container_width=True):
        if st.session_state.calendar_view == "Month":
            if st.session_state.calendar_month == 12:
                st.session_state.calendar_month = 1
                st.session_state.calendar_year += 1
            else:
                st.session_state.calendar_month += 1
        else:  # Week view
            current_date = datetime.date(st.session_state.calendar_year, st.session_state.calendar_month, 1)
            next_week = current_date + datetime.timedelta(days=7)
            st.session_state.calendar_month = next_week.month
            st.session_state.calendar_year = next_week.year
        st.rerun()

# Get all tasks for the user
all_tasks = db.get_tasks_with_urgency({"assignee": st.session_state.user_email})
tasks_by_date = group_tasks_by_date(all_tasks)

# Render calendar
calendar_shell_start()

if st.session_state.calendar_view == "Month":
    render_month_view(
        st.session_state.calendar_year,
        st.session_state.calendar_month,
        tasks_by_date,
        color_mode=st.session_state.calendar_color_mode,
        heatmap_enabled=st.session_state.heatmap_enabled
    )
else:
    render_week_view(
        current_date,
        tasks_by_date,
        color_mode=st.session_state.calendar_color_mode
    )

calendar_shell_end()

# Task Drawer (when day is clicked)
if st.session_state.selected_calendar_date:
    date_obj = st.session_state.selected_calendar_date
    st.markdown("---")
    st.markdown(f"### 📌 {date_obj.strftime('%B %d, %Y')}")
    
    day_tasks = tasks_by_date.get(date_obj, [])
    
    if not day_tasks:
        st.info("No tasks scheduled for this day")
    else:
        for t in day_tasks:
            col_task, col_btn = st.columns([4, 1])
            with col_task:
                st.markdown(f"""
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
                        <div>
                            <strong style="color:#ffffff;">{t['title']}</strong><br>
                            <span style="font-size:12px; color:rgba(255,255,255,0.6);">
                                {t.get('project_name','No Project')} • {t['status']}
                            </span>
                        </div>
                        <span style="font-size:11px;padding:4px 8px;border-radius:6px;background:{t['urgency_color']};color:#000;font-weight:600;">
                            {t['priority']}
                        </span>
                    </div>
                """, unsafe_allow_html=True)
            
            with col_btn:
                if st.button("View", key=f"drawer_view_{t['_id']}", use_container_width=True, type="secondary"):
                    st.session_state.selected_task_id = str(t['_id'])
                    st.switch_page("pages/task_details.py")
    
    if st.button("✕ Close", use_container_width=True):
        st.session_state.selected_calendar_date = None
        st.rerun()

st.markdown("<br>", unsafe_allow_html=True)

# Summary section
col1, col2 = st.columns([2, 1])

with col1:
    st.markdown("### 📋 Upcoming Deadlines")
    
    today = datetime.date.today()
    upcoming_tasks = [
        t for t in all_tasks 
        if t.get('due_date') and t['due_date'].date() >= today 
        and t['due_date'].date() <= today + datetime.timedelta(days=30)
        and t['status'] != 'Completed'
    ]
    
    upcoming_tasks.sort(key=lambda x: x['due_date'])
    
    if not upcoming_tasks:
        st.info("No upcoming deadlines in the next 30 days")
    else:
        for task in upcoming_tasks[:10]:
            days_until = (task['due_date'].date() - today).days
            
            col_task_item, col_task_btn = st.columns([4, 1])
            
            with col_task_item:
                st.markdown(f"""
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
                        <div>
                            <strong style="color:#ffffff;">{task['title']}</strong><br>
                            <span style="font-size:12px; color:rgba(255,255,255,0.6);">
                                {task['due_date'].strftime('%b %d')} • {days_until} days
                            </span>
                        </div>
                        <span style="font-size:11px;padding:4px 8px;border-radius:6px;background:{task['urgency_color']};color:#000;font-weight:600;">
                            {task['status']}
                        </span>
                    </div>
                """, unsafe_allow_html=True)
            
            with col_task_btn:
                if st.button("View", key=f"upcoming_task_{task['_id']}", use_container_width=True, type="secondary"):
                    st.session_state.selected_task_id = str(task['_id'])
                    st.switch_page("pages/task_details.py")

with col2:
    st.markdown("### 🔗 Calendar Sync")
    
    st.markdown("""
        <div class="calendar-integration">
            <h4 style="color: #f6b900; margin:0 0 8px 0;">Google Calendar</h4>
            <p style="color: rgba(255, 255, 255, 0.7); font-size: 13px; margin:0;">
                Sync tasks across devices
            </p>
        </div>
    """, unsafe_allow_html=True)
    
    user = db.get_user(st.session_state.user_email)
    is_connected = user.get('preferences', {}).get('google_calendar_connected', False) if user else False
    
    if is_connected:
        st.success("✅ Connected")
        if st.button("🔄 Sync Now", use_container_width=True, type="secondary"):
            st.success("✅ Synced!")
        if st.button("🔌 Disconnect", use_container_width=True, type="secondary"):
            db.update_user_profile(st.session_state.user_email, {"preferences.google_calendar_connected": False})
            st.rerun()
    else:
        if st.button("🔗 Connect", use_container_width=True, type="secondary"):
            st.warning("⚠️ OAuth in progress")
    
    st.markdown("---")
    st.markdown("### 📊 This Month")
    
    month_start = datetime.date(st.session_state.calendar_year, st.session_state.calendar_month, 1)
    if st.session_state.calendar_month == 12:
        month_end = datetime.date(st.session_state.calendar_year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        month_end = datetime.date(st.session_state.calendar_year, st.session_state.calendar_month + 1, 1) - datetime.timedelta(days=1)
    
    month_tasks = [t for t in all_tasks if t.get('due_date') and month_start <= t['due_date'].date() <= month_end]
    completed_month = len([t for t in month_tasks if t['status'] == 'Completed'])
    total_month = len(month_tasks)
    
    st.metric("Tasks", total_month)
    st.metric("Completed", completed_month)
    st.metric("Rate", f"{round((completed_month / total_month * 100) if total_month > 0 else 0)}%")

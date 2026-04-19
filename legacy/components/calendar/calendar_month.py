"""
Month View - Calendar month grid with tasks
"""
import streamlit as st
import datetime
from .calendar_utils import get_month_matrix, is_today, heat_color, assignee_color
from .calendar_base import day_headers


def render_month_view(year, month, tasks_by_date, color_mode="Priority", heatmap_enabled=False):
    """
    Render month calendar grid
    
    Args:
        year: Year to display
        month: Month to display (1-12)
        tasks_by_date: Dict mapping date objects to list of tasks
        color_mode: "Priority" or "Assignee" - determines dot color
        heatmap_enabled: If True, shows task density as background color
    """
    cal = get_month_matrix(year, month)
    
    # Render day headers
    st.markdown(day_headers(), unsafe_allow_html=True)
    
    # Render calendar days
    for week in cal:
        for day in week:
            if day == 0:
                # Empty cell for days outside current month
                st.markdown('<div class="calendar-day" style="opacity:0.3;"></div>', unsafe_allow_html=True)
            else:
                date_obj = datetime.date(year, month, day)
                day_tasks = tasks_by_date.get(date_obj, [])
                
                # Determine styling
                is_today_flag = is_today(date_obj)
                day_class = "calendar-day calendar-today" if is_today_flag else "calendar-day"
                
                # Heatmap background
                bg_style = ""
                if heatmap_enabled:
                    bg_color = heat_color(len(day_tasks))
                    bg_style = f"background:{bg_color};"
                
                # Build task HTML
                tasks_html = ""
                for task in day_tasks[:3]:
                    # Determine dot color
                    if color_mode == "Assignee":
                        dot_color = assignee_color(task.get("assignee", ""))
                    else:
                        dot_color = task.get("urgency_color", "#f6b900")
                    
                    tasks_html += f"""
                        <div class="calendar-task">
                            <span class="calendar-task-dot" style="background:{dot_color}"></span>
                            {task['title'][:22]}{'…' if len(task['title']) > 22 else ''}
                        </div>
                    """
                
                if len(day_tasks) > 3:
                    tasks_html += f'<div class="calendar-more">+{len(day_tasks) - 3} more</div>'
                
                # Render day cell with click handler
                st.markdown(f"""
                    <div class="{day_class}" style="{bg_style}">
                        <div class="calendar-date">{day}</div>
                        {tasks_html}
                    </div>
                """, unsafe_allow_html=True)
                
                # Click handler for day (opens task drawer)
                if st.button(
                    "●",
                    key=f"day_btn_{date_obj}",
                    help=f"View tasks for {date_obj.strftime('%b %d')}",
                    disabled=len(day_tasks) == 0
                ):
                    st.session_state.selected_calendar_date = date_obj
                    st.rerun()

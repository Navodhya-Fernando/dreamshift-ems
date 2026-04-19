"""
Week View - 7-day calendar view with tasks
"""
import streamlit as st
from .calendar_utils import get_week_range, is_today


def render_week_view(reference_date, tasks_by_date, color_mode="Priority"):
    """
    Render week calendar view (Mon-Sun)
    
    Args:
        reference_date: Any date in the week to display
        tasks_by_date: Dict mapping date objects to list of tasks
        color_mode: "Priority" or "Assignee" - determines dot color
    """
    days = get_week_range(reference_date)
    
    cols = st.columns(7, gap="small")
    
    for col, date_obj in zip(cols, days):
        with col:
            day_tasks = tasks_by_date.get(date_obj, [])
            is_today_flag = is_today(date_obj)
            day_class = "calendar-day calendar-today" if is_today_flag else "calendar-day"
            
            st.markdown(f"""
                <div class="{day_class}">
                    <div class="calendar-date">
                        {date_obj.strftime('%a %d')}
                    </div>
            """, unsafe_allow_html=True)
            
            # Render all tasks for the day (no limit in week view)
            for t in day_tasks:
                # Determine dot color
                if color_mode == "Assignee":
                    from .calendar_utils import assignee_color
                    dot_color = assignee_color(t.get("assignee", ""))
                else:
                    dot_color = t.get("urgency_color", "#f6b900")
                
                st.markdown(f"""
                    <div class="calendar-task">
                        <span class="calendar-task-dot" style="background:{dot_color}"></span>
                        {t['title'][:18]}{'…' if len(t['title']) > 18 else ''}
                    </div>
                """, unsafe_allow_html=True)
            
            st.markdown("</div>", unsafe_allow_html=True)
            
            # Click handler
            if st.button(
                "View",
                key=f"week_day_{date_obj}",
                use_container_width=True,
                type="secondary",
                disabled=len(day_tasks) == 0
            ):
                st.session_state.selected_calendar_date = date_obj
                st.rerun()

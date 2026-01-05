"""
Calendar Utilities - Shared logic for all calendar views
"""
import datetime
import calendar
import streamlit as st


def get_month_matrix(year: int, month: int):
    """Returns a matrix of weeks for the given month"""
    return calendar.monthcalendar(year, month)


def is_today(date_obj):
    """Check if date is today"""
    return date_obj == datetime.date.today()


def group_tasks_by_date(tasks):
    """Group tasks by their due date"""
    grouped = {}
    for t in tasks:
        if t.get("due_date"):
            d = t["due_date"].date()
            grouped.setdefault(d, []).append(t)
    return grouped


def get_week_range(date_obj):
    """Get 7 days starting from Monday of the week containing date_obj"""
    start = date_obj - datetime.timedelta(days=date_obj.weekday())
    return [start + datetime.timedelta(days=i) for i in range(7)]


def heat_color(task_count):
    """
    Returns background color based on task count (heatmap mode)
    - 0 tasks: base dark
    - 1-2: subtle golden
    - 3-5: medium golden
    - 6+: strong golden
    """
    if task_count == 0:
        return "#24101a"
    if task_count <= 2:
        return "rgba(246,185,0,0.15)"
    if task_count <= 5:
        return "rgba(246,185,0,0.35)"
    return "rgba(246,185,0,0.55)"


@st.cache_data(show_spinner=False)
def assignee_color(email):
    """
    Assign consistent color to each team member
    Uses hash to ensure same email always gets same color
    """
    palette = ["#f6b900", "#00ff88", "#4dd0e1", "#ff7043", "#ab47bc"]
    return palette[hash(email) % len(palette)]

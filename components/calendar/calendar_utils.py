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
    - Neutral blues to avoid yellow backgrounds
    """
    if task_count == 0:
        return "#1c2431"
    if task_count <= 2:
        return "rgba(64, 132, 214, 0.18)"  # light blue
    if task_count <= 5:
        return "rgba(64, 132, 214, 0.32)"  # medium blue
    return "rgba(64, 132, 214, 0.48)"       # stronger blue


def assignee_color(email):
    """
    Assign consistent color to each team member.
    Cache was removed to avoid refresh cache errors; hashing keeps colors stable.
    """
    palette = ["#7ec8ff", "#66ffa6", "#9c9cff", "#ff9e80", "#64b5f6"]
    return palette[hash(email) % len(palette)]

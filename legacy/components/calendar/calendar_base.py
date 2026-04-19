"""
Calendar Base - Layout shell components
"""
import streamlit as st


def calendar_shell_start():
    """Start the calendar container"""
    st.markdown('<div class="calendar-shell"><div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;">', unsafe_allow_html=True)


def calendar_shell_end():
    """Close the calendar container"""
    st.markdown('</div></div>', unsafe_allow_html=True)


def calendar_header(title: str):
    """Render centered calendar header with title"""
    st.markdown(f"""
        <div style="text-align:center; margin-bottom:16px;">
            <h2 style="color:#f6b900; margin:0; font-weight:900;">{title}</h2>
        </div>
    """, unsafe_allow_html=True)


def day_headers():
    """Render day of week headers (Mon-Sun)"""
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    html = ""
    for day in days:
        html += f'<div class="calendar-header">{day}</div>'
    return html

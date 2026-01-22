import streamlit as st
import time
from pathlib import Path

def load_global_css():
    with open("static/styles.css") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

def hide_streamlit_sidebar():
    """Hide the default Streamlit sidebar and use only custom sidebar"""
    st.markdown("""
    <style>
        [data-testid="stSidebar"] {
            display: none;
        }
    </style>
    """, unsafe_allow_html=True)

def get_svg(filename, width=30, height=30):
    """Returns SVG string wrapped in a div for flexbox alignment"""
    path = Path(f"static/icons/{filename}")
    if path.exists():
        return f'<div style="width:{width}px; height:{height}px; display:flex; align-items:center;">{path.read_text()}</div>'
    return ""

def render_sidebar_timer():
    """Clockify-style Sidebar Timer"""
    if "timer_start" in st.session_state and st.session_state.timer_running:
        elapsed = int(time.time() - st.session_state.timer_start)
        h, r = divmod(elapsed, 3600)
        m, s = divmod(r, 60)
        time_str = f"{h:02}:{m:02}:{s:02}"
        
        st.sidebar.markdown(f"""
        <div class="ds-timer-card">
            <div style="font-size:0.8rem; color:#fff; opacity:0.7;">TRACKING TIME</div>
            <div class="ds-timer-display">{time_str}</div>
            <div style="font-size:0.75rem; color:#f6b900;">{st.session_state.get('timer_task_title', 'Unknown Task')}</div>
        </div>
        """, unsafe_allow_html=True)
        
        if st.sidebar.button("⏹ Stop Timer", use_container_width=True):
            # Logic to save time handled in main page usually, but we can flag it here
            st.session_state.stop_timer_trigger = True
            st.rerun()

def render_custom_sidebar():
    render_sidebar_timer()
    
    st.sidebar.markdown("### Navigation")
    st.sidebar.page_link("Home.py", label="Home", icon=":material/home:")
    st.sidebar.page_link("pages/inbox.py", label="Inbox", icon=":material/notifications:")
    st.sidebar.page_link("pages/tasks.py", label="Tasks", icon=":material/check_circle:")
    st.sidebar.page_link("pages/projects.py", label="Projects", icon=":material/folder:")
    st.sidebar.page_link("pages/calendar.py", label="Calendar", icon=":material/calendar_month:")
    
    st.sidebar.markdown("### Manage")
    st.sidebar.page_link("pages/workspaces.py", label="Workspaces", icon=":material/domain:")
    st.sidebar.page_link("pages/profile.py", label="Profile", icon=":material/person:")

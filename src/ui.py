import streamlit as st
import time
from pathlib import Path
from src.database import DreamShiftDB

def load_global_css():
    try:
        with open("static/styles.css", "r") as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)
    except FileNotFoundError:
        pass

def get_svg(filename, width=24, height=24):
    """Returns SVG string wrapped in a div"""
    path = Path(f"static/icons/{filename}")
    if path.exists():
        content = path.read_text()
        # Basic dimensions injection if needed, though mostly handled by CSS
        return f'<div style="width:{width}px; height:{height}px; display:flex; align-items:center; justify-content:center;">{content}</div>'
    return ""

def get_status_icon(status_type):
    """Returns Material icon string for status messages (success, error, warning, info)"""
    icons = {
        "success": ":material/check_circle:",
        "error": ":material/error:",
        "warning": ":material/warning:",
        "info": ":material/info:"
    }
    return icons.get(status_type, ":material/info:")

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
        
        if st.sidebar.button("Stop Timer", use_container_width=True):
            st.session_state.stop_timer_trigger = True
            st.rerun()

def hide_streamlit_sidebar():
    """Hide default Streamlit sidebar nav"""
    st.markdown("""
    <style>
    [data-testid="stSidebarNav"] {display: none !important;}
    </style>
    """, unsafe_allow_html=True)

def render_custom_sidebar():
    """Renders the custom sidebar with specific items and SVGs"""
    db = DreamShiftDB()
    
    with st.sidebar:
        # --- LOGO ---
        st.markdown("""
        <div style="margin-bottom: 30px; padding: 10px 0;">
            <h2 style="margin:0; color:#f6b900; font-size: 1.8rem; font-weight: 900;">DreamShift</h2>
        </div>
        """, unsafe_allow_html=True)

        # --- MENU ITEMS ---
        # Using st.page_link with Material icons (SVG path doesn't work directly in st.page_link)
        
        st.page_link("Home.py", label="Home", icon=":material/dashboard:")
        
        # Workspace Switcher (Inline)
        if "user_email" in st.session_state:
            workspaces = db.get_user_workspaces(st.session_state.user_email)
            ws_names = [w['name'] for w in workspaces]
            current_id = st.session_state.get("current_ws_id")
            
            # Find current index
            curr_idx = 0
            if current_id:
                for idx, w in enumerate(workspaces):
                    if str(w['_id']) == current_id:
                        curr_idx = idx
                        break
            
            if ws_names:
                st.markdown('<div style="height:10px"></div>', unsafe_allow_html=True)
                selected_ws = st.selectbox(
                    "Workspace Switcher", 
                    ws_names, 
                    index=curr_idx,
                    label_visibility="collapsed",
                    key="sidebar_ws_select"
                )
                
                if selected_ws:
                    # Update ID if changed
                    for w in workspaces:
                        if w['name'] == selected_ws and str(w['_id']) != current_id:
                            st.session_state.current_ws_id = str(w['_id'])
                            st.rerun()
                st.markdown('<div style="height:10px"></div>', unsafe_allow_html=True)

        st.page_link("pages/workspaces.py", label="Workspaces", icon=":material/group:")
        st.page_link("pages/projects.py", label="Projects", icon=":material/folder:")
        st.page_link("pages/tasks.py", label="Tasks", icon=":material/check_circle:")
        st.page_link("pages/inbox.py", label="Inbox", icon=":material/notifications:")
        st.page_link("pages/profile.py", label="Profile", icon=":material/person:")
        st.page_link("pages/settings.py", label="Settings", icon=":material/settings:")
        
        st.markdown("---")
        
        # Log Out Button (Custom styling to look like a link)
        if st.button("Log Out", key="logout_btn", use_container_width=True):
            st.session_state.clear()
            st.switch_page("pages/sign-in.py")

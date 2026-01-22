import streamlit as st
import time
from pathlib import Path
from src.database import DreamShiftDB

def load_global_css():
    try:
        with open("static/styles.css", "r", encoding="utf-8") as f:
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
    [data-testid="stSidebarNav"],
    section[data-testid="stSidebarNav"],
    [data-testid="stSidebarNav"] * {display: none !important;}
    </style>
    """, unsafe_allow_html=True)

def render_custom_sidebar():
    """Renders the custom sidebar with specific items and SVGs"""
    load_global_css()
    hide_streamlit_sidebar()

    db = DreamShiftDB()
    
    with st.sidebar:
        # --- LOGO ---
        st.markdown("""
        <div class="ds-brand">
            <div class="ds-brand-title">DreamShift</div>
            <div class="ds-brand-subtitle">EMS</div>
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
                st.markdown('<div class="ds-sidebar-section-title">Workspace</div>', unsafe_allow_html=True)
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
                st.markdown('<div class="ds-sidebar-sep"></div>', unsafe_allow_html=True)

        st.markdown('<div class="ds-sidebar-section-title">Navigation</div>', unsafe_allow_html=True)
        st.page_link("pages/workspaces.py", label="Workspaces", icon=":material/group:")
        st.page_link("pages/projects.py", label="Projects", icon=":material/folder:")
        st.page_link("pages/tasks.py", label="Tasks", icon=":material/check_circle:")
        st.page_link("pages/inbox.py", label="Inbox", icon=":material/notifications:")
        st.page_link("pages/profile.py", label="Profile", icon=":material/person:")
        st.page_link("pages/settings.py", label="Settings", icon=":material/settings:")
        
        st.markdown('<div class="ds-sidebar-sep"></div>', unsafe_allow_html=True)

        # User card
        user_name = st.session_state.get("user_name", "User")
        user_email = st.session_state.get("user_email", "")
        if user_email:
            initial = (user_name or user_email)[0].upper()
            st.markdown(
                f"""
                <div class="ds-card ds-card-compact">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="ds-pill" style="width:32px; height:32px; border-radius:50%;">{initial}</div>
                        <div>
                            <div style="font-weight:800;">{user_name}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">{user_email}</div>
                        </div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        
        # Log Out Button (Custom styling to look like a link)
        if st.button("Log Out", key="logout_btn", use_container_width=True):
            st.session_state.clear()
            st.switch_page("pages/sign-in.py")

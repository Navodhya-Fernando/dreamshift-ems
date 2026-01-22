import streamlit as st
import time
from pathlib import Path

def load_global_css():
    try:
        with open("static/styles.css", "r") as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)
    except FileNotFoundError:
        pass

def get_svg(filename, width=30, height=30):
    """Returns SVG string wrapped in a div for flexbox alignment"""
    path = Path(f"static/icons/{filename}")
    if path.exists():
        return f'<div style="width:{width}px; height:{height}px; display:flex; align-items:center;\">{path.read_text()}</div>'
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
    """Hide default Streamlit sidebar nav, keep container for custom sidebar"""
    st.markdown("""
    <style>
    [data-testid="stSidebarNav"] {display: none !important;}
    </style>
    """, unsafe_allow_html=True)

def render_custom_sidebar():
    """Renders the modern custom sidebar using Material icons (SVGs) instead of emojis"""
    render_sidebar_timer()
    
    st.sidebar.markdown("""
    <div style="margin-bottom: 25px; padding-left: 10px; padding-top: 10px;">
        <h2 style="margin:0; color:#f6b900; font-size: 1.6rem; font-weight: 800; letter-spacing: -1px;">DreamShift</h2>
        <p style="margin:0; font-size: 0.8rem; opacity: 0.6; font-weight: 400;">Enterprise System</p>
    </div>
    """, unsafe_allow_html=True)
    
    st.sidebar.markdown('<p style="font-size: 0.75rem; color: #666; font-weight: 600; padding-left: 10px; margin-bottom: 5px;">NAVIGATION</p>', unsafe_allow_html=True)
    st.sidebar.page_link("Home.py", label="Dashboard", icon=":material/home:")
    st.sidebar.page_link("pages/tasks.py", label="My Tasks", icon=":material/check_circle:")
    st.sidebar.page_link("pages/projects.py", label="Projects", icon=":material/folder:")
    st.sidebar.page_link("pages/calendar.py", label="Calendar", icon=":material/calendar_month:")
    st.sidebar.page_link("pages/workspaces.py", label="Team & Spaces", icon=":material/group:")
    
    st.sidebar.markdown('<div style="height: 15px;"></div>', unsafe_allow_html=True)
    
    st.sidebar.markdown('<p style="font-size: 0.75rem; color: #666; font-weight: 600; padding-left: 10px; margin-bottom: 5px;">TOOLS</p>', unsafe_allow_html=True)
    st.sidebar.page_link("pages/inbox.py", label="Inbox", icon=":material/notifications:")
    st.sidebar.page_link("pages/admin-panel.py", label="Admin Panel", icon=":material/admin_panel_settings:")

    st.sidebar.markdown("---")
    
    if "user_email" in st.session_state:
        user_name = st.session_state.get('user_name', 'User')
        user_initial = user_name[0].upper() if user_name else "U"
        
        st.sidebar.markdown(f"""
        <div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(255,255,255,0.03); border-radius:10px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="width:32px; height:32px; background:#f6b900; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#111; font-size: 14px;">
                {user_initial}
            </div>
            <div style="overflow:hidden;">
                <div style="font-size:0.9rem; font-weight:600; white-space:nowrap; color: #eee;">{user_name}</div>
                <div style="font-size:0.75rem; opacity:0.6; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">{st.session_state.user_email}</div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        c1, c2 = st.sidebar.columns(2)
        with c1:
            st.page_link("pages/settings.py", label="Settings", icon=":material/settings:")
        with c2:
            if st.button("Logout", use_container_width=True):
                st.session_state.clear()
                st.switch_page("pages/sign-in.py")
        st.page_link("pages/tasks.py", label="My Tasks", icon=":material/check_circle:")
        st.page_link("pages/projects.py", label="Projects", icon=":material/folder:")
        st.page_link("pages/calendar.py", label="Calendar", icon=":material/calendar_month:")
        st.page_link("pages/workspaces.py", label="Team & Spaces", icon=":material/group:")
        
        st.markdown('<div style="height: 15px;"></div>', unsafe_allow_html=True)
        
        # --- TOOLS SECTION ---
        st.markdown('<p style="font-size: 0.75rem; color: #666; font-weight: 600; padding-left: 10px; margin-bottom: 5px;">TOOLS</p>', unsafe_allow_html=True)
        st.page_link("pages/inbox.py", label="Inbox", icon="🔔")
        st.page_link("pages/admin-panel.py", label="Admin Panel", icon="🛡️")

        # --- USER PROFILE (Pinned to Bottom) ---
        # We use a container and markdown to simulate a "pinned bottom" effect
        st.markdown("---")
        
        if "user_email" in st.session_state:
            user_name = st.session_state.get('user_name', 'User')
            user_initial = user_name[0].upper() if user_name else "U"
            
            # Custom HTML for the mini profile card
            st.markdown(f"""
            <div style="
                display:flex; 
                align-items:center; 
                gap:12px; 
                padding:12px; 
                background:rgba(255,255,255,0.03); 
                border-radius:10px; 
                border: 1px solid rgba(255,255,255,0.05);">
                <div style="
                    width:32px; 
                    height:32px; 
                    background:#f6b900; 
                    border-radius:50%; 
                    display:flex; 
                    align-items:center; 
                    justify-content:center; 
                    font-weight:bold; 
                    color:#111;
                    font-size: 14px;">
                    {user_initial}
                </div>
                <div style="overflow:hidden;">
                    <div style="font-size:0.9rem; font-weight:600; white-space:nowrap; color: #eee;">{user_name}</div>
                    <div style="font-size:0.75rem; opacity:0.6; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">{st.session_state.user_email}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            # Mini links for settings/logout
            c1, c2 = st.columns(2)
            with c1:
                st.page_link("pages/settings.py", label="Settings", icon="⚙️")
            with c2:
                if st.button("Logout", use_container_width=True):
                    st.session_state.clear()
                    st.switch_page("pages/sign-in.py")
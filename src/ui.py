import streamlit as st
from pathlib import Path

def get_svg(svg_file_name, width=24, height=24):
    """
    Loads an SVG file from static/icons, sets its size, and returns it as an HTML img tag.
    Returns None if file not found.
    """
    try:
        # Construct path relative to where the script is run
        file_path = Path("static/icons") / svg_file_name
        
        if file_path.exists():
            with open(file_path, "r") as f:
                svg_content = f.read()
            # Wrap in a div with explicit dimensions
            return f'<div style="width:{width}px; height:{height}px;">{svg_content}</div>'
    except Exception as e:
        return None
    return None

def load_global_css():
    """Loads the custom styles.css from the static directory."""
    try:
        with open("static/styles.css", "r") as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)
    except FileNotFoundError:
        pass # Handle case where file might be missing during dev

def hide_streamlit_sidebar():
    """
    Hides the default Streamlit navigation list (the auto-generated page list)
    but keeps the sidebar container visible so we can inject our own custom menu.
    """
    st.markdown("""
    <style>
    [data-testid="stSidebarNav"] {display: none !important;}
    </style>
    """, unsafe_allow_html=True)

def render_custom_sidebar():
    """
    Renders the modern custom sidebar using st.page_link for navigation.
    This creates a SaaS-like experience (e.g. ClickUp/Slack style).
    """
    with st.sidebar:
        # --- LOGO AREA ---
        st.markdown("""
        <div style="margin-bottom: 25px; padding-left: 10px; padding-top: 10px;">
            <h2 style="margin:0; color:#f6b900; font-size: 1.6rem; font-weight: 800; letter-spacing: -1px;">DreamShift</h2>
            <p style="margin:0; font-size: 0.8rem; opacity: 0.6; font-weight: 400;">Enterprise System</p>
        </div>
        """, unsafe_allow_html=True)
        
        # --- MAIN NAVIGATION ---
        # The 'icon' argument accepts standard emojis. 
        # For custom SVGs, you would need a more complex component, but emojis work best with st.page_link.
        
        st.markdown('<p style="font-size: 0.75rem; color: #666; font-weight: 600; padding-left: 10px; margin-bottom: 5px;">MAIN</p>', unsafe_allow_html=True)
        st.page_link("Home.py", label="Dashboard", icon="🏠")
        st.page_link("pages/tasks.py", label="My Tasks", icon="✅")
        st.page_link("pages/projects.py", label="Projects", icon="📂")
        st.page_link("pages/calendar.py", label="Calendar", icon="📅")
        st.page_link("pages/workspaces.py", label="Team & Spaces", icon="👥")
        
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
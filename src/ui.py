# src/ui.py
import streamlit as st
from pathlib import Path

def load_global_css():
    """Load all global CSS from static/styles.css"""
    css_path = Path("static/styles.css")
    if css_path.exists():
        css_content = css_path.read_text()
        st.markdown(f"<style>{css_content}</style>", unsafe_allow_html=True)

def get_svg(filename, width=24, height=24):
    """Reads a local SVG file from static/icons/ and returns HTML."""
    icon_path = Path(f"static/icons/{filename}")
    if icon_path.exists():
        svg_content = icon_path.read_text()
        return f'<div style="width:{width}px; height:{height}px; display:flex; align-items:center; justify-content:center;">{svg_content}</div>'
    return ""

def hide_streamlit_sidebar():
    """Hide ONLY the default Streamlit navigation menu."""
    st.markdown(
        """
        <style>
        [data-testid="stSidebarNav"] { display: none !important; }
        [data-testid="stSidebarHeader"] { display: none !important; }
        </style>
        """,
        unsafe_allow_html=True,
    )

def render_custom_sidebar():
    """Render professional sidebar with Workspace Switcher."""
    from src.database import DreamShiftDB
    db = DreamShiftDB()

    with st.sidebar:
        # --- WORKSPACE SWITCHER ---
        user_email = st.session_state.get("user_email")
        if user_email:
            st.markdown("<div style='margin-bottom:8px; color:rgba(255,255,255,0.5); font-size:0.75rem; font-weight:700; text-transform:uppercase;'>Workspace</div>", unsafe_allow_html=True)
            workspaces = db.get_user_workspaces(user_email)
            
            if workspaces:
                ws_map = {ws['name']: str(ws['_id']) for ws in workspaces}
                current_ws_id = st.session_state.get("current_ws_id")
                
                # Find current index
                current_index = 0
                if current_ws_id and str(current_ws_id) in ws_map.values():
                    current_index = list(ws_map.values()).index(str(current_ws_id))

                selected_ws = st.selectbox(
                    "Select Workspace", options=list(ws_map.keys()), index=current_index,
                    label_visibility="collapsed", key="sidebar_ws_selector"
                )
                
                # Handle Switch
                if ws_map[selected_ws] != str(current_ws_id):
                    st.session_state.current_ws_id = ws_map[selected_ws]
                    st.session_state.current_ws_name = selected_ws
                    st.session_state.user_role = db.get_user_role(ws_map[selected_ws], user_email)
                    st.rerun()

        st.markdown("---")

        # --- NAVIGATION ---
        st.markdown("<div style='margin-bottom:8px; color:rgba(255,255,255,0.5); font-size:0.75rem; font-weight:700; text-transform:uppercase;'>Apps</div>", unsafe_allow_html=True)
        st.page_link("🏠_Home.py", label="Home", icon=":material/home:")
        st.page_link("pages/3_📋_Tasks.py", label="Tasks", icon=":material/check_circle:")
        st.page_link("pages/2_📁_Projects.py", label="Projects", icon=":material/folder:")
        st.page_link("pages/4_📅_Calendar.py", label="Calendar", icon=":material/calendar_month:")

        st.markdown("<div style='height:15px;'></div>", unsafe_allow_html=True)

        st.markdown("<div style='margin-bottom:8px; color:rgba(255,255,255,0.5); font-size:0.75rem; font-weight:700; text-transform:uppercase;'>Management</div>", unsafe_allow_html=True)
        st.page_link("pages/1_🏢_Workspaces.py", label="Workspaces", icon=":material/domain:")
        st.page_link("pages/5_👤_Profile.py", label="My Profile", icon=":material/account_circle:")
        st.page_link("pages/6_⚙️_Settings.py", label="Settings", icon=":material/settings:")

        if st.session_state.get("user_role") in ["Owner", "Workspace Admin"]:
            st.markdown("<div style='height:15px;'></div>", unsafe_allow_html=True)
            st.markdown("<div style='margin-bottom:8px; color:#f6b900; font-size:0.75rem; font-weight:700; text-transform:uppercase;'>Admin Zone</div>", unsafe_allow_html=True)
            st.page_link("pages/7_👑_Admin_Panel.py", label="Admin Panel", icon=":material/admin_panel_settings:")

        # --- FOOTER ---
        st.markdown("<div style='margin-top:auto; padding-top:30px;'></div>", unsafe_allow_html=True)
        
        user_name = st.session_state.get("user_name", "User")
        
        st.markdown(f"""
        <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px; margin-bottom:10px;">
            <div style="font-size:0.85rem; font-weight:700; color:#fff;">{user_name}</div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.5);">{st.session_state.get("user_role", "Guest")}</div>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown('<div class="ds-logout-btn">', unsafe_allow_html=True)
        if st.button("Log out", icon=":material/logout:", use_container_width=True):
            for k in list(st.session_state.keys()): del st.session_state[k]
            st.switch_page("pages/0_🚪_Sign_In.py")
        st.markdown('</div>', unsafe_allow_html=True)
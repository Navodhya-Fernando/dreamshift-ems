# src/ui.py
"""
Global UI/CSS loader for DreamShift EMS
"""

import streamlit as st
from pathlib import Path

def load_global_css():
    """Load all global CSS from static/styles.css"""
    css_path = Path("static/styles.css")
    if css_path.exists():
        css_content = css_path.read_text()
        st.markdown(f"<style>{css_content}</style>", unsafe_allow_html=True)
    else:
        st.error("⚠️ CSS file not found: static/styles.css")


def hide_streamlit_sidebar():
    """
    Hide ONLY the default Streamlit navigation menu,
    but keep the sidebar container visible for custom content.
    """
    st.markdown(
        """
        <style>
        /* Hide the default navigation menu */
        [data-testid="stSidebarNav"] {
            display: none !important;
        }
        /* Hide the default sidebar header (contains the collapse button space) */
        [data-testid="stSidebarHeader"] {
            display: none !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_custom_sidebar():
    """
    Render a professional sidebar with:
    1. Functional Workspace Switcher (Selectbox)
    2. ClickUp-style Navigation Groups
    3. User Profile & Logout at the bottom
    """
    # Import here to avoid circular dependencies at module level
    from src.database import DreamShiftDB
    db = DreamShiftDB()

    with st.sidebar:
        # --- 1. WORKSPACE SWITCHER ---
        # Ensure user is logged in
        user_email = st.session_state.get("user_email")
        
        if user_email:
            st.markdown("<div style='margin-bottom: 10px; color: rgba(255,255,255,0.5); font-size: 0.8rem; font-weight: 600; text-transform: uppercase;'>Workspace</div>", unsafe_allow_html=True)
            
            # Fetch workspaces for the user
            workspaces = db.get_user_workspaces(user_email)
            
            if workspaces:
                ws_map = {ws['name']: str(ws['_id']) for ws in workspaces}
                current_ws_id = st.session_state.get("current_ws_id")
                
                # Find current index
                current_index = 0
                if current_ws_id:
                    ws_ids = list(ws_map.values())
                    if str(current_ws_id) in ws_ids:
                        current_index = ws_ids.index(str(current_ws_id))

                # Render Switcher
                selected_ws_name = st.selectbox(
                    "Select Workspace",
                    options=list(ws_map.keys()),
                    index=current_index,
                    label_visibility="collapsed",
                    key="sidebar_ws_selector"
                )

                # Handle Switch Logic
                new_ws_id = ws_map[selected_ws_name]
                if str(new_ws_id) != str(current_ws_id):
                    st.session_state.current_ws_id = new_ws_id
                    st.session_state.current_ws_name = selected_ws_name
                    # Fetch new role
                    role = db.get_user_role(new_ws_id, user_email)
                    st.session_state.user_role = role
                    st.rerun()
            else:
                st.info("No workspaces found.")

        st.markdown("---")

        # --- 2. MAIN NAVIGATION ---
        
        # Section: APPS
        st.markdown("<div style='margin-bottom: 8px; color: rgba(255,255,255,0.5); font-size: 0.8rem; font-weight: 600; text-transform: uppercase;'>Apps</div>", unsafe_allow_html=True)
        st.page_link("🏠_Home.py", label="Home", icon=":material/home:")
        st.page_link("pages/3_📋_Tasks.py", label="Tasks", icon=":material/check_circle:")
        st.page_link("pages/2_📁_Projects.py", label="Projects", icon=":material/folder:")
        st.page_link("pages/4_📅_Calendar.py", label="Calendar", icon=":material/calendar_month:")

        st.markdown("<div style='height: 15px;'></div>", unsafe_allow_html=True)

        # Section: MANAGEMENT
        st.markdown("<div style='margin-bottom: 8px; color: rgba(255,255,255,0.5); font-size: 0.8rem; font-weight: 600; text-transform: uppercase;'>Management</div>", unsafe_allow_html=True)
        st.page_link("pages/1_🏢_Workspaces.py", label="Workspaces", icon=":material/domain:")
        st.page_link("pages/5_👤_Profile.py", label="My Profile", icon=":material/account_circle:")
        st.page_link("pages/6_⚙️_Settings.py", label="Settings", icon=":material/settings:")

        # --- 3. ADMIN SECTION (Conditional) ---
        if st.session_state.get("user_role") in ["Owner", "Workspace Admin"]:
            st.markdown("<div style='height: 15px;'></div>", unsafe_allow_html=True)
            st.markdown("<div style='margin-bottom: 8px; color: #f6b900; font-size: 0.8rem; font-weight: 700; text-transform: uppercase;'>Admin Zone</div>", unsafe_allow_html=True)
            st.page_link("pages/7_👑_Admin_Panel.py", label="Admin Panel", icon=":material/admin_panel_settings:")

        # --- 4. FOOTER & LOGOUT ---
        st.markdown("<div style='margin-top: 30px;'></div>", unsafe_allow_html=True)
        
        # User Info Card
        user_name = st.session_state.get("user_name", "User")
        user_role = st.session_state.get("user_role", "Guest")
        
        st.markdown(f"""
        <div style="
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 10px;
            border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 0.9rem; font-weight: 700; color: #fff;">{user_name}</div>
            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6);">{user_role}</div>
        </div>
        """, unsafe_allow_html=True)

        if st.button("🚪 Log out", use_container_width=True):
            # Clear session
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            # Redirect
            st.switch_page("pages/0_🚪_Sign_In.py")
            st.switch_page("pages/0_🚪_Sign_In.py")




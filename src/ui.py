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




# NOTE: hide_streamlit_sidebar() function removed - no longer needed
# We now use Streamlit's initial_sidebar_state="expanded" for all pages
# and render_custom_sidebar() to display our professional navigation
# def hide_streamlit_sidebar():
#     """Hide the default Streamlit sidebar completely"""
#     st.markdown(
#         """
#         <style>
#         /* Hide default Streamlit sidebar */
#         [data-testid="stSidebarNav"] {
#             display: none !important;
#         }
#         section[data-testid="stSidebar"] {
#             display: none !important;
#             width: 0 !important;
#         }
#         [data-testid="stSidebar"] {
#             display: none !important;
#             width: 0 !important;
#         }
#         </style>
#         """,
#         unsafe_allow_html=True,
#     )


def render_custom_sidebar():
    """
    Render a professional, ClickUp-like sidebar with:
    1. Current Workspace header (Avatar + Name)
    2. Main Navigation (Material Icons)
    3. Admin Section (Conditional)
    4. Logout button at bottom
    """
    # Define navigation items: (Label, Page Path, Material Icon)
    # Note: Page paths must match your actual filenames exactly.
    nav_links = [
        ("Home", "🏠_Home.py", ":material/home:"),
        ("Workspaces", "pages/1_🏢_Workspaces.py", ":material/domain:"),
        ("Projects", "pages/2_📁_Projects.py", ":material/folder:"),
        ("Tasks", "pages/3_📋_Tasks.py", ":material/check_circle:"),
        ("Calendar", "pages/4_📅_Calendar.py", ":material/calendar_month:"),
        ("Profile", "pages/5_👤_Profile.py", ":material/account_circle:"),
        ("Settings", "pages/6_⚙️_Settings.py", ":material/settings:"),
    ]

    with st.sidebar:
        # --- 1. WORKSPACE HEADER (ClickUp Style) ---
        current_ws = st.session_state.get("current_ws_name", "Select Workspace")
        role = st.session_state.get("user_role", "Guest")
        
        # Determine avatar letter
        avatar_letter = current_ws[0].upper() if current_ws and current_ws != "Select Workspace" else "W"

        # Render Workspace Card using HTML/CSS
        st.markdown(f"""
        <div style="
            background: rgba(255,255,255,0.05); 
            border: 1px solid rgba(255,255,255,0.1); 
            border-radius: 12px; 
            padding: 12px; 
            margin-top: 10px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.2s ease;">
            <div style="
                min-width: 36px; height: 36px; 
                background: linear-gradient(135deg, #f6b900 0%, #ffcf33 100%); 
                border-radius: 8px; 
                display: flex; align-items: center; justify-content: center; 
                font-weight: 800; color: #411c30; font-size: 18px;
                box-shadow: 0 2px 8px rgba(246,185,0,0.3);">
                {avatar_letter}
            </div>
            <div style="overflow: hidden;">
                <div style="font-weight: 700; font-size: 14px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.3px;">
                    {current_ws}
                </div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
                    {role}
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        # --- 2. MAIN NAVIGATION ---
        st.markdown("<div style='color:rgba(255,255,255,0.4); font-size:11px; font-weight:700; margin-bottom:12px; padding-left:4px; text-transform:uppercase; letter-spacing: 0.8px;'>Menu</div>", unsafe_allow_html=True)
        
        for label, page, icon in nav_links:
            st.page_link(page, label=label, icon=icon)

        # --- 3. ADMIN SECTION (Conditional) ---
        if st.session_state.get("user_role") in ["Owner", "Workspace Admin"]:
            st.markdown("<div style='height: 24px;'></div>", unsafe_allow_html=True)
            st.markdown("<div style='color:rgba(255,255,255,0.4); font-size:11px; font-weight:700; margin-bottom:12px; padding-left:4px; text-transform:uppercase; letter-spacing: 0.8px;'>Admin</div>", unsafe_allow_html=True)
            st.page_link("pages/7_👑_Admin_Panel.py", label="Admin Panel", icon=":material/admin_panel_settings:")

        # --- 4. FOOTER & LOGOUT ---
        st.markdown("<div style='margin-top: auto; padding-top: 40px;'></div>", unsafe_allow_html=True)
        
        # Visual divider handled by CSS or st.markdown if needed, but spacing is usually enough
        if st.button("🚪 Log out", use_container_width=True):
            # Clear session state
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            
            # Force redirect to login
            st.switch_page("pages/0_🚪_Sign_In.py")




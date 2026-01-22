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
    """Hide the default Streamlit sidebar completely"""
    st.markdown(
        """
        <style>
        /* Hide default Streamlit sidebar */
        [data-testid="stSidebarNav"] {
            display: none !important;
        }
        section[data-testid="stSidebar"] {
            display: none !important;
            width: 0 !important;
        }
        [data-testid="stSidebar"] {
            display: none !important;
            width: 0 !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_custom_sidebar():
    """
    Render a custom sidebar with icon-based navigation using st.page_link.
    Creates a fixed sidebar with clickable icon navigation.
    Uses styles from styles.css - no inline CSS here.
    """
    # Create navigation in sidebar
    with st.sidebar:
        st.markdown(
            "<div style='height: 5px;'></div>",
            unsafe_allow_html=True,
        )
        
        nav_items = [
            ("🏠", "🏠_Home.py"),
            ("🏢", "pages/1_🏢_Workspaces.py"),
            ("📁", "pages/2_📁_Projects.py"),
            ("📋", "pages/3_📋_Tasks.py"),
            ("📅", "pages/4_📅_Calendar.py"),
            ("👤", "pages/5_👤_Profile.py"),
            ("⚙️", "pages/6_⚙️_Settings.py"),
            ("👑", "pages/7_👑_Admin_Panel.py"),
            ("🎯", "pages/8_🎯_Task_Templates.py"),
            ("🔍", "pages/9_🔍_Debug.py"),
        ]
        
        for icon, page in nav_items:
            col = st.columns([1])[0]
            with col:
                st.page_link(page, label=icon, icon=None)




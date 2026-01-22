# src/ui.py
"""
Global UI/CSS loader for DreamShift EMS
All styling is centralized in static/styles.css for easy maintenance.
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


def hide_default_sidebar_and_setup_layout():
    """
    Properly hide the default Streamlit sidebar using aggressive CSS
    and adjust layout for full-width content area.
    """
    st.markdown(
        """
        <style>
        /* AGGRESSIVELY hide Streamlit's default sidebar */
        section[data-testid="stSidebar"] {
            display: none !important;
            width: 0 !important;
            min-width: 0 !important;
            visibility: hidden !important;
        }
        
        [data-testid="stSidebar"] {
            display: none !important;
            width: 0 !important;
            min-width: 0 !important;
            visibility: hidden !important;
        }
        
        .stDeployButton {
            display: none;
        }
        
        /* Adjust main content to full width */
        .appview-container {
            margin-left: 0 !important;
        }
        
        [data-testid="stAppViewContainer"] {
            margin-left: 0 !important;
        }
        
        .main {
            width: 100%;
            margin-left: 0 !important;
            padding-left: 0 !important;
        }
        
        .block-container {
            max-width: 100%;
            width: 100%;
            padding-left: 2rem;
            padding-right: 2rem;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_custom_sidebar_navigation():
    """
    Render custom sidebar navigation using Streamlit's built-in navigation.
    This works with Streamlit's page routing system.
    """
    # Define navigation
    pages = {
        "Home": "🏠_Home.py",
        "Sign In": "pages/0_🚪_Sign_In.py",
        "Workspaces": "pages/1_🏢_Workspaces.py",
        "Projects": "pages/2_📁_Projects.py",
        "Tasks": "pages/3_📋_Tasks.py",
        "Calendar": "pages/4_📅_Calendar.py",
        "Profile": "pages/5_👤_Profile.py",
        "Settings": "pages/6_⚙️_Settings.py",
        "Admin": "pages/7_👑_Admin_Panel.py",
        "Templates": "pages/task_templates.py",
        "Debug": "pages/9_🔍_Debug.py",
    }
    
    # Render sidebar using Streamlit columns (will appear in default sidebar position)
    with st.sidebar:
        st.markdown("### Navigation")
        for label, page in pages.items():
            st.page_link(page, label=label, use_container_width=True)


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
    """
    # Add CSS for custom sidebar styling
    st.markdown(
        """
        <style>
        /* Style sidebar container */
        [data-testid="stSidebar"] {
            background: linear-gradient(135deg, #411c30 0%, #24101a 100%) !important;
            width: 80px !important;
        }
        
        [data-testid="stSidebar"] > div:first-child {
            width: 80px !important;
        }
        
        /* Hide sidebar label/title */
        [data-testid="stSidebar"] .stMarkdown {
            height: 20px;
        }
        
        /* Style page links to look like icon buttons */
        [data-testid="stSidebar"] [data-testid="stPageLink-nav"] {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 60px;
            font-size: 24px;
            background: transparent;
            color: rgba(255,255,255,0.7);
            margin: 4px 0;
            border-radius: 8px;
            border: 2px solid transparent;
            transition: all 0.2s ease;
            text-decoration: none;
            padding: 0 !important;
        }
        
        [data-testid="stSidebar"] [data-testid="stPageLink-nav"]:hover {
            background: rgba(246,185,0,0.15) !important;
            color: #f6b900 !important;
            border-color: rgba(246,185,0,0.3) !important;
            transform: scale(1.05);
        }
        
        /* Hide page link text, show only the icon part */
        [data-testid="stSidebar"] [data-testid="stPageLink-nav"] span {
            display: none;
        }
        
        [data-testid="stSidebar"] [data-testid="stPageLink-nav"] .st-emotion-cache-1gulkj5 {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
    
    # Create navigation in sidebar
    with st.sidebar:
        st.markdown(
            "<div style='height: 10px;'></div>",
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
            st.page_link(page, label=icon, icon=None)




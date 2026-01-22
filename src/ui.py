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
    Render a custom sidebar with icon-based navigation using Streamlit components.
    Uses st.sidebar to create a fixed sidebar with icon navigation.
    """
    # Add CSS for custom sidebar styling
    st.markdown(
        """
        <style>
        /* Push main content to account for sidebar */
        .appview-container {
            margin-left: 0;
        }
        
        /* Style sidebar */
        [data-testid="stSidebar"] {
            background: linear-gradient(135deg, #411c30 0%, #24101a 100%);
            width: 80px !important;
        }
        
        [data-testid="stSidebar"] > div:first-child {
            width: 80px !important;
            padding: 0 !important;
        }
        
        /* Style sidebar buttons */
        [data-testid="stSidebar"] .stButton > button {
            width: 100%;
            height: 60px;
            font-size: 24px;
            border: 2px solid transparent;
            background: transparent;
            color: rgba(255,255,255,0.7);
            margin: 4px 0;
            border-radius: 8px;
            transition: all 0.2s ease;
            padding: 0;
        }
        
        [data-testid="stSidebar"] .stButton > button:hover {
            background: rgba(246,185,0,0.15);
            color: #f6b900;
            border-color: rgba(246,185,0,0.3);
            transform: scale(1.05);
        }
        
        /* Hide button text, show only icons */
        [data-testid="stSidebar"] .stButton > button > p {
            display: none;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
    
    # Create navigation in sidebar
    with st.sidebar:
        st.markdown(
            "<div style='height: 20px;'></div>",
            unsafe_allow_html=True,
        )
        
        nav_items = [
            ("🏠", "🏠_Home.py"),
            ("🏢", "1_🏢_Workspaces.py"),
            ("📁", "2_📁_Projects.py"),
            ("📋", "3_📋_Tasks.py"),
            ("📅", "4_📅_Calendar.py"),
            ("👤", "5_👤_Profile.py"),
            ("⚙️", "6_⚙️_Settings.py"),
            ("👑", "7_👑_Admin_Panel.py"),
            ("🎯", "8_🎯_Task_Templates.py"),
            ("🔍", "9_🔍_Debug.py"),
        ]
        
        for icon, page in nav_items:
            if st.button(icon, key=f"nav_{page}", use_container_width=True):
                st.switch_page(f"pages/{page}" if page != "🏠_Home.py" else page)




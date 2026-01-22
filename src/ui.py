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
            padding: 0 !important;
        }
        
        [data-testid="stSidebar"] > div {
            padding: 10px 0 !important;
            width: 80px !important;
        }
        
        /* Reset all button styles inside sidebar */
        [data-testid="stSidebar"] .stButton > button {
            width: 60px !important;
            height: 60px !important;
            padding: 0 !important;
            margin: 4px auto !important;
            background: transparent !important;
            color: rgba(255, 255, 255, 0.7) !important;
            border: 2px solid transparent !important;
            border-radius: 8px !important;
            font-size: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s ease !important;
            box-shadow: none !important;
        }
        
        /* Sidebar button hover state */
        [data-testid="stSidebar"] .stButton > button:hover {
            background: #f6b900 !important;
            color: #411c30 !important;
            border-color: #f6b900 !important;
            transform: scale(1.08) !important;
        }
        
        /* Hide button text wrapper */
        [data-testid="stSidebar"] .stButton > button > p {
            display: none !important;
        }
        
        /* Focus state */
        [data-testid="stSidebar"] .stButton > button:focus {
            outline: none !important;
            box-shadow: none !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
    
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




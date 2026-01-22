# src/ui.py
"""
Global UI/CSS loader for DreamShift EMS
All styling is centralized in static/styles.css for easy maintenance.

This module provides a single function to load all CSS for the application,
ensuring a consistent look and feel across all pages.
"""

import streamlit as st
from pathlib import Path


def load_global_css():
    """
    Load all global CSS from static/styles.css
    
    This is the single source of truth for all styling across the application.
    By centralizing CSS in one file, we ensure:
    - Easy maintenance and updates
    - No duplicate rules
    - Consistent styling across all pages
    - Better performance (single CSS load)
    
    If the CSS file is not found, displays an error message.
    """
    css_path = Path("static/styles.css")
    if css_path.exists():
        css_content = css_path.read_text()
        st.markdown(f"<style>{css_content}</style>", unsafe_allow_html=True)
    else:
        st.error("⚠️ CSS file not found: static/styles.css")


def hide_default_sidebar():
    """
    Hide the default Streamlit sidebar and modify the layout to use full width.
    This allows for custom sidebar implementation.
    """
    st.markdown(
        """
        <style>
        /* Hide default sidebar */
        [data-testid="stSidebar"] {
            display: none;
        }
        
        /* Make main content full width */
        .main {
            width: 100%;
            margin-left: 0 !important;
        }
        
        .block-container {
            width: 100%;
            max-width: 100%;
            padding-left: 0 !important;
            padding-right: 0 !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_custom_sidebar():
    """
    Render a custom sidebar with icons instead of file names.
    Shows navigation with emoji icons and proper styling.
    """
    # Navigation items: (icon, label, page_path)
    nav_items = [
        ("🏠", "Home", "🏠_Home.py"),
        ("🚪", "Sign In", "pages/0_🚪_Sign_In.py"),
        ("🏢", "Workspaces", "pages/1_🏢_Workspaces.py"),
        ("📁", "Projects", "pages/2_📁_Projects.py"),
        ("📋", "Tasks", "pages/3_📋_Tasks.py"),
        ("📅", "Calendar", "pages/4_📅_Calendar.py"),
        ("👤", "Profile", "pages/5_👤_Profile.py"),
        ("⚙️", "Settings", "pages/6_⚙️_Settings.py"),
        ("👑", "Admin", "pages/7_👑_Admin_Panel.py"),
        ("🎯", "Templates", "pages/8_🎯_Task_Templates.py"),
        ("🔍", "Debug", "pages/9_🔍_Debug.py"),
    ]
    
    # Render custom sidebar container
    st.markdown(
        """
        <style>
        .custom-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            height: 100vh;
            width: 80px;
            background: linear-gradient(135deg, #411c30 0%, #24101a 100%);
            border-right: 1px solid rgba(255,255,255,0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px 0;
            z-index: 999;
            overflow-y: auto;
        }
        
        .custom-sidebar-item {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 60px;
            height: 60px;
            margin: 8px 0;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 24px;
            text-decoration: none;
            color: rgba(255,255,255,0.7);
            background: transparent;
            border: 2px solid transparent;
        }
        
        .custom-sidebar-item:hover {
            background: rgba(246,185,0,0.15);
            color: #f6b900;
            border-color: rgba(246,185,0,0.3);
            transform: scale(1.1);
        }
        
        .custom-sidebar-item.active {
            background: rgba(246,185,0,0.2);
            color: #f6b900;
            border-color: #f6b900;
        }
        
        .custom-sidebar-item span {
            display: none;
        }
        
        .custom-sidebar-item:hover span {
            display: block;
            position: absolute;
            left: 80px;
            background: rgba(65, 28, 48, 0.95);
            color: #f6b900;
            padding: 6px 12px;
            border-radius: 8px;
            white-space: nowrap;
            font-size: 12px;
            margin-left: 8px;
            border: 1px solid rgba(246,185,0,0.3);
        }
        
        /* Push main content to the right */
        .main {
            margin-left: 80px !important;
            width: calc(100% - 80px) !important;
        }
        </style>
        
        <div class="custom-sidebar">
        """,
        unsafe_allow_html=True,
    )
    
    # Render navigation items
    for icon, label, page in nav_items:
        st.markdown(
            f"""
            <a href="/{page}" class="custom-sidebar-item" title="{label}">
                {icon}
                <span>{label}</span>
            </a>
            """,
            unsafe_allow_html=True,
        )
    
    st.markdown("</div>", unsafe_allow_html=True)

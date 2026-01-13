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


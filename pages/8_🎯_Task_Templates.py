import streamlit as st
import datetime
import html
from bson import ObjectId
from src.database import DreamShiftDB

# Page config
st.set_page_config(page_title="Task Templates - DreamShift EMS", page_icon="🎯", layout="wide", initial_sidebar_state="expanded")

# Load base CSS and setup
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

# Hide default Streamlit sidebar
hide_streamlit_sidebar()

# Render custom sidebar
render_custom_sidebar()

# Load global CSS
load_global_css()

# Placeholder for Template management functionality
st.title("🎯 Task Templates")
st.info("Task template management interface will be implemented here")
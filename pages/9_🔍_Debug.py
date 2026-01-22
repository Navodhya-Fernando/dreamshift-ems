import streamlit as st
import pandas as pd
from src.database import DreamShiftDB

st.set_page_config(page_title="System Status", page_icon="🔍", layout="wide")

from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar
hide_streamlit_sidebar()
render_custom_sidebar()
load_global_css()

# Only allow admins
if st.session_state.get("user_role") not in ["Owner", "Workspace Admin"]:
    st.error("Access Denied")
    st.stop()

st.markdown("""
<div class="ds-page-head">
  <h1 class="ds-page-title" style="display:flex; align-items:center; gap:10px;">
    :material/terminal: System Status
  </h1>
  <p class="ds-page-sub">Session and State Debugging</p>
</div>
""", unsafe_allow_html=True)

st.markdown("### :material/memory: Session State")
st.json(dict(st.session_state), expanded=False)

st.markdown("### :material/database: Connection Check")
db = DreamShiftDB()
try:
    st.success(f"Connected to MongoDB", icon=":material/check_circle:")
except Exception as e:
    st.error(f"Connection Failed: {e}", icon=":material/error:")

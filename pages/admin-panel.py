import streamlit as st
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Admin Panel", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
render_custom_sidebar()

if st.session_state.get("user_role") not in ["Owner", "Workspace Admin"]:
    st.error("Access Denied")
    st.stop()

icon = get_svg("admin.svg", 36, 36) or ":material/admin_panel_settings:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Admin Panel</h1></div>""", unsafe_allow_html=True)
st.write("System Admin Controls")
import streamlit as st
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Task Templates", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
render_custom_sidebar()

icon = get_svg("templates.svg", 36, 36) or ":material/extension:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Templates</h1></div>""", unsafe_allow_html=True)
st.write("Manage Task Templates")
import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Profile", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

icon = get_svg("profile.svg", 36, 36) or ":material/person:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Profile</h1></div>""", unsafe_allow_html=True)

user = db.get_user(st.session_state.user_email)
st.markdown(f"""<div class="ds-card"><h2>{user['name']}</h2><p>{user['email']}</p></div>""", unsafe_allow_html=True)
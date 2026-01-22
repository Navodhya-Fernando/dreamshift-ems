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
stats = db.get_user_stats(st.session_state.user_email)

col1, col2 = st.columns([1, 2])

with col1:
    st.markdown(f"""
    <div class="ds-card" style="text-align:center;">
        <h1 style="font-size:3rem;">👤</h1>
        <h2>{user['name']}</h2>
        <p style="color:#888;">{user['email']}</p>
        <div class="ds-badge" style="margin:auto;">{user.get('role', 'Member')}</div>
    </div>
    """, unsafe_allow_html=True)
    
    if st.button("Log Out", use_container_width=True):
        st.session_state.clear()
        st.switch_page("pages/sign-in.py")

with col2:
    st.subheader("Performance")
    c1, c2 = st.columns(2)
    c1.metric("Tasks Completed", stats['completed'])
    c2.metric("On-Time Rate", f"{stats['rate']}%")
    
    st.subheader("Account Security")
    if st.button("Reset Password"):
        st.switch_page("pages/password-reset.py")
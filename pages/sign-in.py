import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css

st.set_page_config(page_title="Sign In", layout="centered", initial_sidebar_state="collapsed")
load_global_css()
db = DreamShiftDB()

st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
st.markdown("<h1>DreamShift <span style='color:#f6b900'>EMS</span></h1>", unsafe_allow_html=True)

with st.form("login"):
    email = st.text_input("Email")
    password = st.text_input("Password", type="password")
    if st.form_submit_button("Sign In", use_container_width=True):
        user = db.authenticate_user(email, password)
        if user:
            st.session_state.user_email = email
            st.session_state.user_name = user['name']
            st.switch_page("Home.py")
        else:
            st.error("Invalid credentials")

if st.button("Forgot Password?", type="secondary"):
    st.switch_page("pages/password-reset.py")
st.markdown('</div>', unsafe_allow_html=True)
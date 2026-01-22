import streamlit as st
import time
from src.database import DreamShiftDB

st.set_page_config(page_title="Reset Password", page_icon="🔑", layout="centered")
from src.ui import load_global_css
load_global_css()

db = DreamShiftDB()

token = st.query_params.get("reset_token")

st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
st.markdown("<h2>🔐 Set New Password</h2>", unsafe_allow_html=True)

if not token:
    st.error("Invalid or missing reset token.")
    if st.button("Return to Login"):
        st.switch_page("pages/0_🚪_Sign_In.py")
else:
    with st.form("reset_pw_form"):
        p1 = st.text_input("New Password", type="password")
        p2 = st.text_input("Confirm Password", type="password")
        
        if st.form_submit_button("Reset Password", use_container_width=True):
            if p1 != p2:
                st.error("Passwords do not match.")
            elif len(p1) < 6:
                st.error("Password too short.")
            else:
                success = db.reset_password_with_token(token, p1)
                if success:
                    st.success("Password reset! Redirecting...")
                    time.sleep(2)
                    st.switch_page("pages/0_🚪_Sign_In.py")
                else:
                    st.error("Token invalid or expired.")

st.markdown('</div>', unsafe_allow_html=True)

st.markdown('</div>', unsafe_allow_html=True)

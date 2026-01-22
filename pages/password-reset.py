import streamlit as st
from src.ui import load_global_css

st.set_page_config(page_title="Reset Password", layout="centered")
load_global_css()

st.markdown('<div class="ds-login-wrap"><h2>Reset Password</h2><p>Contact admin to reset.</p></div>', unsafe_allow_html=True)
if st.button("Back"): st.switch_page("pages/sign-in.py")
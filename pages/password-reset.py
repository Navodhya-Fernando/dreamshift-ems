import streamlit as st
from src.ui import load_global_css

st.set_page_config(page_title="Reset Password", layout="centered")
load_global_css()

st.markdown('''
<div class="ds-login-wrap">
	<h2 class="ds-login-title" style="font-size:1.6rem;">Reset Password</h2>
	<p class="ds-login-subtitle">Contact admin to reset your password.</p>
</div>
''', unsafe_allow_html=True)
if st.button("Back"): st.switch_page("pages/sign-in.py")
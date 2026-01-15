import streamlit as st
from src.database import DreamShiftDB

st.set_page_config(page_title="Verify Email Change", page_icon="✉️", layout="centered")

db = DreamShiftDB()

token = st.query_params.get("token")

st.title("Verify Email Change")

if not token:
    st.error("Missing verification token.")
    st.stop()

col_btn, col_spacer = st.columns([1, 8])
with col_btn:
    if st.button("Verify", use_container_width=True):
        if db.confirm_email_change(token):
            st.success("✅ Email change confirmed. You can now log in with your new email.")
        else:
            st.error("Verification failed or token expired.")

st.caption("If this link has expired, request a new email change from your profile settings.")
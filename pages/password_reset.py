import streamlit as st
import datetime
import time
from src.database import DreamShiftDB

st.set_page_config(
    page_title="Reset Password - DreamShift EMS",
    page_icon="🔐",
    layout="centered",
    initial_sidebar_state="collapsed",
)

db = DreamShiftDB()

# Get reset token from URL
reset_token = st.query_params.get("reset_token")

# Styling
st.markdown(
    """
    <style>
      :root{
        --bg:#24101a;
        --accent:#411c30;
        --text:#ffffff;
      }
      body{
        background: var(--bg);
        color: var(--text);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      .ds-reset-wrap{
        max-width: 450px;
        margin: 60px auto;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 20px;
        padding: 50px 40px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      }
      .ds-reset-title{
        color: #f6b900;
        font-size: 28px;
        font-weight: 900;
        text-align: left;
        margin-bottom: 10px;
        letter-spacing: 0.5px;
      }
      .ds-reset-subtitle{
        color: rgba(255,255,255,0.6);
        text-align: left;
        font-size: 14px;
        margin-bottom: 30px;
      }
      .stTextInput > label, .stForm > label{
        color: rgba(255,255,255,0.8);
        font-weight: 600;
        font-size: 13px;
      }
      .ds-gap-section{
        margin-top: 1.5rem;
        margin-bottom: 1.5rem;
      }
      .ds-gap-card{
        margin-top: 1rem;
        margin-bottom: 1rem;
      }
      .ds-gap-inline{
        margin-right: 0.5rem;
        margin-left: 0.5rem;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown('<div class="ds-reset-wrap">', unsafe_allow_html=True)

if not reset_token:
    st.markdown('<h1 class="ds-reset-title">🔐 Password Reset</h1>', unsafe_allow_html=True)
    st.markdown('<p class="ds-reset-subtitle">Invalid or missing reset link</p>', unsafe_allow_html=True)
    st.error("❌ Reset link is invalid or expired. Please request a new password reset.")
    st.markdown("</div>", unsafe_allow_html=True)
    st.stop()

# Show reset form
st.markdown('<h1 class="ds-reset-title">🔐 Create New Password</h1>', unsafe_allow_html=True)
st.markdown('<p class="ds-reset-subtitle">Enter your new password below</p>', unsafe_allow_html=True)

with st.form("reset_password_form"):
    new_password = st.text_input(
        "New Password",
        type="password",
        placeholder="Enter new password (min 6 characters)"
    )
    confirm_password = st.text_input(
        "Confirm Password",
        type="password",
        placeholder="Confirm your new password"
    )
    
    col1, col2 = st.columns(2)
    submit = col1.form_submit_button("🔄 Reset Password", use_container_width=True, type="primary")
    back = col2.form_submit_button("← Back to Login", use_container_width=True)
    
    if back:
        st.switch_page("pages/0_🚪_Sign_In.py")
        st.stop()
    
    if submit:
        # Validation
        if not new_password or not confirm_password:
            st.error("❌ Please fill in all fields")
        elif new_password != confirm_password:
            st.error("❌ Passwords don't match!")
        elif len(new_password) < 6:
            st.error("❌ Password must be at least 6 characters")
        else:
            # Attempt reset
            if db.reset_password_with_token(reset_token, new_password):
                st.success("✅ Password reset successful!")
                st.markdown("**Redirecting to login page...**")
                time.sleep(2)
                st.query_params.clear()
                st.switch_page("pages/0_🚪_Sign_In.py")
                st.stop()
            else:
                st.error("❌ Reset token is invalid or expired. Please request a new password reset.")

st.markdown('</div>', unsafe_allow_html=True)

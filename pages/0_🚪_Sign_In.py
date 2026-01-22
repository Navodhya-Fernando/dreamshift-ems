import streamlit as st
import datetime
import time
import secrets
import hashlib
import html
import os
from src.database import DreamShiftDB
from src.mailer import send_email

# 1. Page Config: "centered" layout is crucial here
st.set_page_config(
    page_title="Sign In - DreamShift EMS",
    page_icon="static/icons/login.svg",
    layout="centered",
    initial_sidebar_state="collapsed",
)

# Load UI utilities
from src.ui import load_global_css
load_global_css()

db = DreamShiftDB()

# --- HELPER FUNCTIONS ---
def set_session(user_email: str, user_name: str):
    st.session_state.user_email = user_email
    st.session_state.user_name = user_name
    token = db.create_session_token(user_email)
    st.session_state.session_token = token
    st.query_params.update({"session_token": token})

def render_header():
    """Renders the logo/title inside the card"""
    st.markdown(
        """
        <div style="text-align: center;">
            <h1 class="ds-login-title">DreamShift <span>EMS</span></h1>
            <p class="ds-login-sub">Employee Management System</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

# --- AUTH LOGIC (Redirect if logged in) ---
if st.session_state.get("user_email"):
    if "session_token" not in st.session_state:
        token = db.create_session_token(st.session_state["user_email"])
        st.session_state.session_token = token
    st.switch_page("🏠_Home.py")

# Check URL token
incoming_token = st.query_params.get("session_token")
if incoming_token and "user_email" not in st.session_state:
    user = db.get_session_by_token(incoming_token)
    if user:
        set_session(user["email"], user.get("name", user["email"].split("@")[0]))
        st.switch_page("🏠_Home.py")

# Initialize toggles
if "show_forgot_password" not in st.session_state:
    st.session_state.show_forgot_password = False
if "show_signup" not in st.session_state:
    st.session_state.show_signup = False

# --- VIEW: FORGOT PASSWORD ---
if st.session_state.show_forgot_password:
    st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
    render_header()
    st.markdown("### Reset Password")
    st.markdown("<p style='color:#ccc; font-size: 14px;'>Enter your email address and we'll send you a reset link.</p>", unsafe_allow_html=True)

    with st.form("forgot_password_form"):
        reset_email = st.text_input("Email Address", placeholder="your.email@company.com").strip()
        
        st.markdown("<div style='height: 10px'></div>", unsafe_allow_html=True)
        
        submit_btn = st.form_submit_button("Send Reset Link", use_container_width=True)
        
        if submit_btn and reset_email:
            user = db.get_user_by_email(reset_email)
            if user:
                # (Reset logic preserved from your original code)
                reset_token = secrets.token_urlsafe(32)
                token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
                expiry = datetime.datetime.now() + datetime.timedelta(hours=1)
                db.save_reset_token(reset_email, token_hash, expiry)
                
                base_url = os.getenv('APP_BASE_URL', 'http://localhost:8501')
                reset_link = f"{base_url}/password_reset?reset_token={reset_token}"
                
                # Simple HTML email content
                html_content = f"""
                <p>Hi {html.escape(user['name'])},</p>
                <p>Click here to reset your password: <a href="{reset_link}">Reset Password</a></p>
                """
                try:
                    send_email(reset_email, "Password Reset", html_content)
                    st.success("✅ Check your email!")
                    time.sleep(2)
                    st.session_state.show_forgot_password = False
                    st.rerun()
                except Exception as e:
                    st.error(f"Error: {e}")
            else:
                st.error("Email not found.")

    # Back button outside form
    if st.button("Back to Login", use_container_width=True):
        st.session_state.show_forgot_password = False
        st.rerun()

    st.markdown('</div>', unsafe_allow_html=True)
    st.stop()

# --- VIEW: SIGN UP ---
if st.session_state.show_signup:
    st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
    render_header()
    st.markdown("### Create Account")
    
    with st.form("signup_form"):
        new_name = st.text_input("Full Name").strip()
        new_email = st.text_input("Email").strip()
        new_password = st.text_input("Password", type="password")
        confirm_password = st.text_input("Confirm Password", type="password")
        
        st.markdown("<div style='height: 15px'></div>", unsafe_allow_html=True)
        create_btn = st.form_submit_button("Create Account", use_container_width=True)

        if create_btn:
            if not new_name or not new_email or not new_password:
                st.error("All fields required.")
            elif new_password != confirm_password:
                st.error("Passwords do not match.")
            elif db.is_email_taken(new_email):
                st.error("Email already taken.")
            else:
                db.create_user(new_email, new_password, new_name)
                st.success("Account created! Please login.")
                time.sleep(1)
                st.session_state.show_signup = False
                st.rerun()

    if st.button("Back to Login", use_container_width=True):
        st.session_state.show_signup = False
        st.rerun()
        
    st.markdown("</div>", unsafe_allow_html=True)
    st.stop()

# --- VIEW: LOGIN (Default) ---
st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
render_header()

with st.form("login_form"):
    email = st.text_input("Email Address", placeholder="name@company.com").strip()
    password = st.text_input("Password", type="password", placeholder="••••••••")
    
    st.markdown("<div style='height: 20px'></div>", unsafe_allow_html=True)
    
    # This button will now pick up the strict CSS styles
    login_btn = st.form_submit_button("Sign In", use_container_width=True)
    
    if login_btn:
        if not email or not password:
            st.error("Please enter email and password.")
        else:
            user = db.authenticate_user(email, password)
            if user:
                set_session(email, user['name'])
                st.success(f"Welcome, {user['name']}!")
                time.sleep(0.5)
                st.switch_page("🏠_Home.py")
            else:
                st.error("Invalid credentials.")

st.markdown('</div>', unsafe_allow_html=True)

# Secondary Actions (Forgot Password / Create Account)
# Using columns for better alignment below the card
col1, col2 = st.columns(2)

with col1:
    st.markdown('<div class="ds-secondary">', unsafe_allow_html=True)
    if st.button("Forgot password?", use_container_width=True):
        st.session_state.show_forgot_password = True
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)

with col2:
    st.markdown('<div class="ds-secondary">', unsafe_allow_html=True)
    if st.button("Create account", use_container_width=True):
        st.session_state.show_signup = True
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)
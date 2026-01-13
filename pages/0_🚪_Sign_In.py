import streamlit as st
import datetime
import time
import secrets
import hashlib
import html
from src.database import DreamShiftDB
from src.mailer import send_email

st.set_page_config(
    page_title="Sign In - DreamShift EMS",
    page_icon="🚪",
    layout="centered",
    initial_sidebar_state="collapsed",
)

db = DreamShiftDB()

# If already authenticated, push token to URL and go home
if st.session_state.get("user_email"):
    if "session_token" not in st.session_state:
        token = db.create_session_token(st.session_state["user_email"])
        st.session_state.session_token = token
    st.query_params.update({"session_token": st.session_state.session_token})
    st.switch_page("🏠_Home.py")
    st.stop()

# Auto-login if session token comes from a shared link
incoming_token = st.query_params.get("session_token")
if incoming_token and "user_email" not in st.session_state:
    user = db.get_session_by_token(incoming_token)
    if user:
        st.session_state.user_email = user["email"]
        st.session_state.user_name = user.get("name", user["email"].split("@")[0])
        st.session_state.session_token = incoming_token
        st.switch_page("🏠_Home.py")
        st.stop()

# Styling for login page with global consistency
st.markdown(
    """
    <style>
      :root{
        --bg:#24101a;
        --panel:#411c30;
        --panel2:rgba(255,255,255,0.06);
        --border:rgba(255,255,255,0.10);
        --muted:rgba(255,255,255,0.70);
        --text:#ffffff;
        --accent:#f6b900;
        --accent2:#ffc933;
      }
      .stApp{ background:var(--bg)!important; }
      [data-testid="stSidebar"] { display:none; }
      .block-container{
        max-width: 420px !important;
        padding-top: 3.2rem !important;
        padding-bottom: 3rem !important;
      }
      h1,h2,h3,h4{ letter-spacing:-0.2px; color:var(--text); }
      .stMarkdown p, .stMarkdown span, .stMarkdown div{ color: var(--text) !important; }
      [data-testid="stMarkdownContainer"] h1 a, [data-testid="stMarkdownContainer"] h2 a, [data-testid="stMarkdownContainer"] h3 a { display: none !important; }
      .stTextInput input, .stTextArea textarea{ background: var(--panel2) !important; border: 1px solid var(--border) !important; border-radius: 12px !important; color: var(--text) !important; }
      .stTextInput input:focus, .stTextArea textarea:focus{ border-color: rgba(246,185,0,0.55) !important; box-shadow: 0 0 0 2px rgba(246,185,0,0.18) !important; }
      .stButton button, .stFormSubmitButton button{ background: var(--accent) !important; color: #411c30 !important; border: 0 !important; border-radius: 12px !important; padding: 0.72rem 1rem !important; font-weight: 850 !important; transition: all 0.18s ease !important; }
      .stButton button:hover, .stFormSubmitButton button:hover{ background: #ffe500 !important; color: #411c30 !important; transform: translateY(-1px); box-shadow: 0 10px 26px rgba(255,229,0,0.35) !important; }
      .ds-login-wrap{
        background:var(--panel);
        border:1px solid var(--border);
        border-radius:18px;
        padding:22px 22px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.55);
      }
      .ds-login-title{
        margin:0;
        font-size:1.9rem;
        font-weight: 900;
        letter-spacing:-0.4px;
        color:#fff;
      }
      .ds-login-title span{ color:var(--accent); }
      .ds-login-sub{
        margin:6px 0 0;
        color: var(--muted);
        font-size:0.95rem;
      }
      .ds-divider{
        height:1px;
        background: var(--border);
        margin:16px 0 16px;
      }
      div[data-testid="stForm"]{
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
      }
      .ds-secondary .stButton button{
        background: transparent !important;
        color: rgba(255,255,255,0.85) !important;
        border: 1px solid var(--border) !important;
      }
      .ds-secondary .stButton button:hover{
        background: rgba(255,255,255,0.06) !important;
        color: rgba(255,255,255,0.95) !important;
        border-color: rgba(255,255,255,0.16) !important;
        transform:none !important;
        box-shadow: none !important;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

# Helpers
def set_session(user_email: str, user_name: str):
    st.session_state.user_email = user_email
    st.session_state.user_name = user_name
    token = db.create_session_token(user_email)
    st.session_state.session_token = token
    st.query_params.update({"session_token": token})


# Initialize toggles
for key, default in {
    "show_forgot_password": False,
    "show_reset_form": False,
    "show_signup": False,
}.items():
    if key not in st.session_state:
        st.session_state[key] = default


def render_header():
    st.markdown(
        """
          <h1 class="ds-login-title">DreamShift <span>EMS</span></h1>
          <p class="ds-login-sub">Employee Management System</p>
          <div class="ds-divider"></div>
        """,
        unsafe_allow_html=True,
    )


# Forgot Password
if st.session_state.show_forgot_password:
    st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
    render_header()
    st.markdown("### Reset Password")
    st.markdown("Enter your email address and we'll send you a reset link.")

    with st.form("forgot_password_form"):
        reset_email = st.text_input("Email Address", placeholder="your.email@company.com").strip()
        col1, col2 = st.columns(2)
        send_btn = col1.form_submit_button("Send Reset Link", use_container_width=True)
        cancel_btn = col2.form_submit_button("Cancel", use_container_width=True)

        if send_btn and reset_email:
            user = db.get_user_by_email(reset_email)
            if user:
                reset_token = secrets.token_urlsafe(32)
                token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
                expiry = datetime.datetime.now() + datetime.timedelta(hours=1)
                db.save_reset_token(reset_email, token_hash, expiry)
                reset_link = f"http://localhost:8501?reset_token={reset_token}"
                html_content = f"""
<html>
<body style=\"font-family: Arial, sans-serif; background: #24101a; color: #ffffff; padding: 40px;\">
    <div style=\"max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.06); border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);\">
        <h1 style=\"color: #f6b900; text-align: center;\">Password Reset</h1>
        <p style=\"font-size: 16px; line-height: 1.6;\">Hi {html.escape(user['name'])},</p>
        <p style=\"font-size: 16px; line-height: 1.6;\">We received a request to reset your password for your DreamShift EMS account.</p>
        <p style=\"font-size: 16px; line-height: 1.6;\">Click the button below to reset your password:</p>
        <div style=\"text-align: center; margin: 30px 0;\">
            <a href=\"{reset_link}\" style=\"background: #f6b900; color: #161616; padding: 15px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;\">Reset Password</a>
        </div>
        <p style=\"font-size: 14px; color: rgba(255, 255, 255, 0.7);\">Or copy this link: {reset_link}</p>
        <p style=\"font-size: 14px; color: rgba(255, 255, 255, 0.7);\">This link will expire in 1 hour.</p>
        <p style=\"font-size: 14px; color: rgba(255, 255, 255, 0.7); margin-top: 30px;\">If you didn't request this, please ignore this email.</p>
        <div style=\"text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);\">
            <p style=\"color: rgba(255, 255, 255, 0.5); font-size: 12px;\">DreamShift Employee Management System</p>
        </div>
    </div>
</body>
</html>
"""
                try:
                    send_email(reset_email, "Password Reset - DreamShift EMS", html_content)
                    st.success("✅ Reset link sent! Check your email.")
                    time.sleep(2)
                    st.session_state.show_forgot_password = False
                    st.rerun()
                except Exception as e:
                    st.error(f"Failed to send email: {str(e)}")
            else:
                st.error("No account found with that email address.")

        if cancel_btn:
            st.session_state.show_forgot_password = False
            st.rerun()

    st.markdown('</div>', unsafe_allow_html=True)
    st.stop()

# Reset form via link
if st.session_state.show_reset_form:
    st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
    render_header()
    st.markdown("### Create New Password")
    with st.form("reset_password_form"):
        new_password = st.text_input("New Password", type="password", placeholder="Enter new password")
        confirm_password = st.text_input("Confirm Password", type="password", placeholder="Confirm new password")
        col1, col2 = st.columns(2)
        reset_btn = col1.form_submit_button("Reset Password", use_container_width=True)
        cancel_btn = col2.form_submit_button("Cancel", use_container_width=True)
        if reset_btn:
            if new_password != confirm_password:
                st.error("Passwords don't match!")
            elif len(new_password) < 6:
                st.error("Password must be at least 6 characters.")
            else:
                token = st.query_params.get("reset_token")
                if db.reset_password_with_token(token, new_password):
                    st.success("✅ Password reset successful! Please login.")
                    time.sleep(2)
                    st.session_state.show_reset_form = False
                    st.query_params.clear()
                    st.rerun()
                else:
                    st.error("Invalid or expired reset link.")
        if cancel_btn:
            st.session_state.show_reset_form = False
            st.query_params.clear()
            st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)
    st.stop()

# Signup form
if st.session_state.get('show_signup', False):
    st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
    render_header()
    st.markdown("### Create Account")
    with st.form("signup_form"):
        new_name = st.text_input("Full Name", placeholder="John Doe").strip()
        new_email = st.text_input("Email", placeholder="john.doe@company.com").strip()
        new_password = st.text_input("Password", type="password", placeholder="Create a strong password")
        confirm_password = st.text_input("Confirm Password", type="password", placeholder="Re-enter password")
        col1, col2 = st.columns(2)
        create_btn = col1.form_submit_button("Create Account", use_container_width=True)
        cancel_btn = col2.form_submit_button("Back to Login", use_container_width=True)
        if create_btn:
            if not new_name or not new_email or not new_password:
                st.error("All fields are required.")
            elif "@" not in new_email:
                st.error("Enter a valid email address.")
            elif new_password != confirm_password:
                st.error("Passwords don't match!")
            elif len(new_password) < 6:
                st.error("Password must be at least 6 characters long!")
            elif db.is_email_taken(new_email):
                st.error("Email already registered!")
            else:
                try:
                    db.create_user(new_email, new_password, new_name)
                    st.success("Account created successfully! Please login.")
                    st.session_state.show_signup = False
                    time.sleep(0.8)
                    st.rerun()
                except Exception:
                    st.error("Signup failed. Please check your connection and try again.")
        if cancel_btn:
            st.session_state.show_signup = False
            st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)
    st.stop()

# Default: login form
st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
render_header()
with st.form("login_form"):
    email = st.text_input("Email", placeholder="your.email@company.com").strip()
    password = st.text_input("Password", type="password", placeholder="Enter your password")
    login_btn = st.form_submit_button("Sign In", use_container_width=True)
    if login_btn:
        if not email or not password:
            st.error("Email and password are required.")
        else:
            user = db.authenticate_user(email, password)
            if user:
                set_session(email, user['name'])
                st.success(f"Welcome back, {user['name']}!")
                time.sleep(0.8)
                st.switch_page("🏠_Home.py")
            else:
                st.error("Invalid credentials. Please try again.")

st.markdown("<div style='height:14px;'></div>", unsafe_allow_html=True)
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

# Handle reset token in URL
if "reset_token" in st.query_params:
    st.session_state.show_reset_form = True
    st.rerun()

st.markdown('</div>', unsafe_allow_html=True)
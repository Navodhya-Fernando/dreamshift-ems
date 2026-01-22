import streamlit as st
import time
from src.database import DreamShiftDB
from src.ui import load_global_css

st.set_page_config(page_title="Sign In", layout="centered", initial_sidebar_state="collapsed")
load_global_css()

# -----------------------------
# DB connection
# -----------------------------
try:
    db = DreamShiftDB()
    db_connected = True
except Exception as e:
    st.error(f"Database Connection Failed: {e}")
    db_connected = False

# Already logged in
if st.session_state.get("user_email"):
    st.switch_page("Home.py")

# -----------------------------
# Minimal, modern auth shell
# (CSS will be finalized later)
# -----------------------------
st.markdown(
    """
    <div class="ds-auth-shell">
      <div class="ds-auth-brand">
        <div class="ds-auth-logo">
          <div class="ds-auth-logo-mark"></div>
          <div class="ds-auth-logo-text">DreamShift <span>EMS</span></div>
        </div>
        <div class="ds-auth-sub">Employee Management System</div>
      </div>
    """,
    unsafe_allow_html=True,
)

if not db_connected:
    st.markdown(
        """
        <div class="ds-card">
          <div class="ds-card-title">Connection issue</div>
          <div class="ds-card-subtitle">Please try again in a moment or contact your administrator.</div>
        </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.stop()

tab1, tab2 = st.tabs(["Sign In", "Create Account"])

# -----------------------------
# SIGN IN
# -----------------------------
with tab1:
    st.markdown("<div class='ds-auth-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-auth-title'>Welcome back</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-auth-hint'>Sign in to continue to your workspace.</div>", unsafe_allow_html=True)

    with st.form("login_form", clear_on_submit=False):
        email = st.text_input("Email Address", placeholder="name@company.com")
        password = st.text_input("Password", type="password", placeholder="Your password")

        a1, a2 = st.columns([1.2, 1.2])
        submit = a1.form_submit_button("Sign In", use_container_width=True, type="primary")
        forgot = a2.form_submit_button("Forgot Password", use_container_width=True, type="secondary")

        if forgot:
            st.switch_page("pages/password_reset.py")

        if submit:
            if not (email or "").strip() or not (password or "").strip():
                st.error("Email and password are required.")
            else:
                user = db.authenticate_user(email.strip(), password)
                if user:
                    st.session_state.user_email = email.strip()
                    st.session_state.user_name = user.get("name") or "User"
                    st.success("Signed in.")
                    time.sleep(0.3)
                    st.switch_page("Home.py")
                else:
                    st.error("Invalid email or password.")

    st.markdown("</div>", unsafe_allow_html=True)

# -----------------------------
# SIGN UP
# -----------------------------
with tab2:
    st.markdown("<div class='ds-auth-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-auth-title'>Create account</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-auth-hint'>Create an account to join your team workspace.</div>", unsafe_allow_html=True)

    with st.form("signup_form", clear_on_submit=False):
        new_name = st.text_input("Full Name", placeholder="Your name")
        new_email = st.text_input("Email", placeholder="name@company.com")
        new_pass = st.text_input("Password", type="password", placeholder="At least 6 characters")
        confirm_pass = st.text_input("Confirm Password", type="password", placeholder="Re-enter password")

        a1, a2 = st.columns([1.2, 1.2])
        create = a1.form_submit_button("Create Account", use_container_width=True, type="primary")
        cancel = a2.form_submit_button("Cancel", use_container_width=True, type="secondary")

        if cancel:
            st.stop()

        if create:
            if not (new_name or "").strip():
                st.error("Full Name is required.")
            elif not (new_email or "").strip():
                st.error("Email is required.")
            elif not (new_pass or "").strip():
                st.error("Password is required.")
            elif len(new_pass) < 6:
                st.error("Password must be at least 6 characters.")
            elif new_pass != confirm_pass:
                st.error("Passwords do not match.")
            else:
                success, msg = db.create_user(new_email.strip(), new_pass, new_name.strip())
                if success:
                    st.success("Account created. You can now sign in.")
                else:
                    st.error(f"Error: {msg}")

    st.markdown("</div>", unsafe_allow_html=True)

# Close wrapper
st.markdown("</div>", unsafe_allow_html=True)

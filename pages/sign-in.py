import streamlit as st
import time
from src.database import DreamShiftDB
from src.ui import load_global_css

st.set_page_config(page_title="Sign In", page_icon="static/icons/home.svg", layout="centered", initial_sidebar_state="collapsed")
load_global_css()

# Initialize DB connection safely
try:
    db = DreamShiftDB()
    db_connected = True
except Exception as e:
    st.error(f"Database Connection Failed: {e}")
    db_connected = False

if st.session_state.get("user_email"):
    st.switch_page("Home.py")

st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
st.markdown("""
    <h1 class="ds-login-title">DreamShift <span style="color: #f6b900;">EMS</span></h1>
    <p class="ds-login-subtitle">Employee Management System</p>
""", unsafe_allow_html=True)

if db_connected:
    tab1, tab2 = st.tabs(["Sign In", "Create Account"])

    # --- SIGN IN TAB ---
    with tab1:
        with st.form("login_form"):
            email = st.text_input("Email Address")
            password = st.text_input("Password", type="password")
            st.markdown("<div style='height: 10px'></div>", unsafe_allow_html=True)
            
            if st.form_submit_button("Sign In", use_container_width=True):
                user = db.authenticate_user(email, password)
                if user:
                    st.session_state.user_email = email
                    st.session_state.user_name = user['name']
                    st.success(f"Welcome back, {user['name']}!")
                    time.sleep(0.5)
                    st.switch_page("Home.py")
                else:
                    st.error("Invalid email or password.")
        
        if st.button("Forgot Password?", type="secondary"):
            st.switch_page("pages/password-reset.py")

    # --- CREATE ACCOUNT TAB ---
    with tab2:
        with st.form("signup_form"):
            new_name = st.text_input("Full Name")
            new_email = st.text_input("Email")
            new_pass = st.text_input("Password", type="password")
            confirm_pass = st.text_input("Confirm Password", type="password")
            st.markdown("<div style='height: 10px'></div>", unsafe_allow_html=True)
            
            if st.form_submit_button("Create Account", use_container_width=True):
                if new_pass != confirm_pass:
                    st.error("Passwords do not match.")
                elif len(new_pass) < 6:
                    st.error("Password must be at least 6 characters.")
                else:
                    success, msg = db.create_user(new_email, new_pass, new_name)
                    if success:
                        st.success("Account created! You can now Sign In.")
                    else:
                        st.error(f"Error: {msg}")

st.markdown('</div>', unsafe_allow_html=True)
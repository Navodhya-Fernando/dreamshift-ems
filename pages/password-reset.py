import streamlit as st
from src.ui import load_global_css

st.set_page_config(page_title="Reset Password", layout="centered", initial_sidebar_state="collapsed")
load_global_css()

# Auth-style minimal shell (same vibe as sign-in)
st.markdown(
    """
    <div class="ds-auth-shell">
      <div class="ds-auth-brand">
        <div class="ds-auth-logo">
          <div class="ds-auth-logo-mark"></div>
          <div class="ds-auth-logo-text">DreamShift <span>EMS</span></div>
        </div>
        <div class="ds-auth-sub">Reset Password</div>
      </div>

      <div class="ds-auth-card">
        <div class="ds-auth-title">Password reset</div>
        <div class="ds-auth-hint">For now, password resets are handled by an administrator.</div>
    """,
    unsafe_allow_html=True,
)

st.markdown("<div class='ds-divider'></div>", unsafe_allow_html=True)

# Minimal action area
c1, c2 = st.columns([1.2, 1.2])
with c1:
    if st.button("Back to sign in", type="secondary", use_container_width=True):
        st.switch_page("pages/sign-in.py")
with c2:
    if st.button("Open Settings", type="primary", use_container_width=True):
        # If user is already logged in, this is useful. If not, it will redirect.
        if "user_email" in st.session_state:
            st.switch_page("pages/settings.py")
        else:
            st.switch_page("pages/sign-in.py")

st.markdown(
    """
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

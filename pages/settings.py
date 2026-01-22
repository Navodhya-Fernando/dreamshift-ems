import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Settings", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

db = DreamShiftDB()

# Auth guard
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

# Header (SVG only, no emoji fallback)
icon = get_svg("settings.svg", 28, 28)
st.markdown(
    f"""
    <div class="ds-page-head">
        <div class="ds-page-head-left">
            <div class="ds-page-icon">{icon}</div>
            <div class="ds-page-titles">
                <div class="ds-page-title">Settings</div>
                <div class="ds-page-subtitle">Manage your preferences and notification settings.</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

user = db.get_user(st.session_state.user_email) or {}
prefs = user.get("preferences", {}) or {}

# -----------------------------
# Notifications
# -----------------------------
st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
st.markdown("<div class='ds-card-title'>Notifications</div>", unsafe_allow_html=True)
st.markdown(
    "<div class='ds-card-subtitle'>Choose how you want to receive alerts and updates.</div>",
    unsafe_allow_html=True,
)

email_notif = st.toggle(
    "Receive email notifications",
    value=bool(prefs.get("email_notifications", True)),
)

a1, a2 = st.columns([1.2, 4.8])
save = a1.button("Save", type="primary", use_container_width=True)
cancel = a2.button("Cancel", type="secondary", use_container_width=True)

if cancel:
    st.stop()

if save:
    db.db.users.update_one(
        {"email": st.session_state.user_email},
        {"$set": {"preferences": {"email_notifications": email_notif}}},
    )
    st.success("Preferences saved.")

st.markdown("</div>", unsafe_allow_html=True)

# -----------------------------
# Account (minimal placeholder for future)
# -----------------------------
st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)
st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
st.markdown("<div class='ds-card-title'>Account</div>", unsafe_allow_html=True)
st.markdown(
    "<div class='ds-card-subtitle'>More account settings can live here later (password, profile, security).</div>",
    unsafe_allow_html=True,
)
st.markdown("<div class='ds-empty-mini'>No additional account settings yet.</div>", unsafe_allow_html=True)
st.markdown("</div>", unsafe_allow_html=True)

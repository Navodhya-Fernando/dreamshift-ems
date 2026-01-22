import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Profile", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

db = DreamShiftDB()

# Auth guard
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

# Header (SVG only)
icon = get_svg("profile.svg", 28, 28)
st.markdown(
    f"""
    <div class="ds-page-head">
        <div class="ds-page-head-left">
            <div class="ds-page-icon">{icon}</div>
            <div class="ds-page-titles">
                <div class="ds-page-title">Profile</div>
                <div class="ds-page-subtitle">Your account overview and personal stats.</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

user = db.get_user(st.session_state.user_email) or {}
stats = db.get_user_stats(st.session_state.user_email) or {}

name = (user.get("name") or "Member").strip()
email = (user.get("email") or st.session_state.user_email or "unknown").strip()
role = (user.get("role") or "Member").strip()

# Initials (no emoji avatar)
initials = "".join([p[0] for p in name.split()[:2] if p]).upper() or "U"

# Layout
left, right = st.columns([1.1, 2.0])

with left:
    # Profile card
    st.markdown(
        f"""
        <div class="ds-card ds-profile-card">
            <div class="ds-avatar">{initials}</div>
            <div class="ds-profile-name">{name}</div>
            <div class="ds-profile-email">{email}</div>
            <div class="ds-profile-role">{role}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Actions
    a1, a2 = st.columns(2)
    with a1:
        if st.button("Settings", use_container_width=True, type="secondary"):
            st.switch_page("pages/settings.py")
    with a2:
        if st.button("Log out", use_container_width=True, type="secondary"):
            st.session_state.clear()
            st.switch_page("pages/sign-in.py")

with right:
    # Performance
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Performance</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>A quick snapshot of your work this workspace.</div>", unsafe_allow_html=True)

    c1, c2, c3 = st.columns(3)
    c1.metric("Tasks completed", stats.get("completed", 0))
    c2.metric("Completion rate", f"{stats.get('rate', 0)}%")
    c3.metric("Assigned tasks", stats.get("assigned", 0))

    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)

    # Security
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Security</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>Manage your password and account access.</div>", unsafe_allow_html=True)

    s1, s2 = st.columns([3, 2])
    with s1:
        st.markdown(
            """
            <div class="ds-security-row">
                <div class="ds-security-k">Password</div>
                <div class="ds-security-v">You can reset your password anytime.</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with s2:
        if st.button("Reset password", use_container_width=True, type="primary"):
            # Keep existing route (your repo uses password_reset.py elsewhere)
            st.switch_page("pages/password_reset.py")

    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)

    # Preferences (non-edit placeholder; settings page holds the toggle)
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Preferences</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>Inbox alerts are enabled. Email preferences are in Settings.</div>", unsafe_allow_html=True)

    st.markdown(
        """
        <div class="ds-empty-mini">
            Mentions, reminders, and admin alerts appear in Inbox. Email digests can be added later.
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("</div>", unsafe_allow_html=True)

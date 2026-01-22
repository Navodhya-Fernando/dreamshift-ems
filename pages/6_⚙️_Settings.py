import streamlit as st
from src.database import DreamShiftDB

st.set_page_config(
    page_title="Settings | DreamShift",
    page_icon="static/icons/settings.svg",
    layout="wide",
    initial_sidebar_state="expanded",
)

from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

hide_streamlit_sidebar()
render_custom_sidebar()
load_global_css()

db = DreamShiftDB()

if "user_email" not in st.session_state:
    st.switch_page("pages/0_🚪_Sign_In.py")

user = db.get_user(st.session_state.user_email) or {}
prefs = user.get("preferences", {})

st.markdown(
    """
    <div class="ds-page-head">
      <h1 class="ds-page-title" style="display:flex; align-items:center; gap:10px;">
        :material/settings: Settings
      </h1>
      <p class="ds-page-sub">App preferences and configuration</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# --- PREFERENCES ---
st.markdown("### :material/tune: App Preferences")
with st.container(border=True):
    col1, col2 = st.columns(2)

    with col1:
        st.write("**Notifications**")
        email_notifs = st.toggle("Email Notifications", value=prefs.get("email_notifications", True))
        task_reminders = st.toggle("Task Reminders", value=prefs.get("task_reminders", True))

    with col2:
        st.write("**Appearance**")
        st.selectbox(
            "Theme Mode",
            ["Dark (Default)", "Light", "System"],
            disabled=True,
            help="DreamShift uses a forced dark theme currently.",
        )
        compact_mode = st.toggle("Compact Density", value=prefs.get("compact_mode", False))

    if st.button("Save Preferences", type="primary"):
        db.update_user_profile_fields(
            user.get("email", ""),
            {
                "preferences.email_notifications": email_notifs,
                "preferences.task_reminders": task_reminders,
                "preferences.compact_mode": compact_mode,
            },
        )
        st.success("Settings saved")

st.markdown("<div style='height:20px'></div>", unsafe_allow_html=True)

# --- DANGER ZONE ---
st.markdown("### :material/dangerous: Danger Zone")
st.markdown(
    """
    <div class="ds-card" style="border: 1px solid #ff4d4d; background: rgba(255, 77, 77, 0.05);">
        <h4 style="color:#ff4d4d; margin-top:0;">Leave Workspace</h4>
        <p style="font-size:14px; opacity:0.8;">You will lose access to all projects and tasks in this workspace.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

if st.button("Leave Workspace", type="primary"):
    st.error("Please contact your Workspace Admin to be removed.")

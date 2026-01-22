import datetime
import streamlit as st
from src.database import DreamShiftDB

st.set_page_config(
    page_title="Profile | DreamShift",
    page_icon="static/icons/profile.svg",
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

user_email = st.session_state.user_email
user = db.get_user(user_email) or {}
stats = db.get_user_stats(user_email) or {}

profile = user.get("profile", {})
name = user.get("name", "DreamShift User")
initial = name[:1].upper() if name else "U"
role_title = profile.get("role_title", "Team Member")
joined = profile.get("date_joined") or user.get("created_at") or datetime.date.today()


def fmt_date(value):
    try:
        if isinstance(value, datetime.datetime):
            return value.strftime("%Y-%m-%d")
        if isinstance(value, datetime.date):
            return value.strftime("%Y-%m-%d")
        return datetime.datetime.fromisoformat(str(value)).strftime("%Y-%m-%d")
    except Exception:
        return "N/A"


# --- HEADER ---
st.markdown(
    """
    <div class="ds-page-head">
      <h1 class="ds-page-title" style="display:flex; align-items:center; gap:10px;">
        :material/account_circle: My Profile
      </h1>
    </div>
    """,
    unsafe_allow_html=True,
)

# --- PROFILE CARD ---
col_left, col_right = st.columns([1, 2])

with col_left:
    st.markdown(
        f"""
        <div class="ds-card" style="text-align:center; padding:30px;">
            <div style="width:80px; height:80px; margin:0 auto 15px; background:rgba(246,185,0,0.2); color:#f6b900; font-size:32px; font-weight:900; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid #f6b900;">
                {initial}
            </div>
            <h2 style="margin:0; font-size:1.5rem;">{name}</h2>
            <p style="color:rgba(255,255,255,0.5); margin:5px 0 20px;">{user.get('email','')}</p>
            <span class="ds-pill ds-pill-accent">{role_title}</span>
            <div style="margin-top:20px; font-size:12px; color:#666;">Joined: {fmt_date(joined)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with col_right:
    st.markdown("### Performance")
    c1, c2, c3 = st.columns(3)
    c1.metric("Tasks Completed", stats.get("completed", 0))
    c2.metric("Completion Rate", f"{stats.get('rate', 0)}%")
    c3.metric("Hours Logged", f"{stats.get('total_hours', 0)}h")

    st.markdown("<div style='height:20px'></div>", unsafe_allow_html=True)

    with st.expander(":material/edit: Edit Profile Details", expanded=False):
        with st.form("profile_edit"):
            new_name = st.text_input("Display Name", value=name)
            new_role = st.text_input("Job Title", value=role_title)

            if st.form_submit_button("Save Changes", use_container_width=True):
                db.update_user_profile_fields(
                    user.get("email", ""),
                    {
                        "name": new_name,
                        "profile.role_title": new_role,
                    },
                )
                st.success("Profile updated")
                st.rerun()

    with st.expander(":material/lock: Security & Sessions", expanded=False):
        st.info(
            "To change your password, please use the reset flow on the login page for maximum security.",
            icon=":material/lock:",
        )
        if st.button("Log out on all devices", type="primary"):
            db.delete_sessions_for_user(user.get("email", ""))
            st.success("Sessions cleared. Please sign in again.")
            st.switch_page("pages/0_🚪_Sign_In.py")

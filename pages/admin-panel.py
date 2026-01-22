import streamlit as st
import pandas as pd

from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Admin Console", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

db = DreamShiftDB()

# Auth guard
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

# Role guard (minimal + clear)
user = db.get_user(st.session_state.user_email) or {}
is_admin = (user.get("role") == "Admin")

if not is_admin:
    st.markdown(
        """
        <div class="ds-empty-state">
          <div class="ds-empty-title">Access restricted</div>
          <div class="ds-empty-sub">You do not have permission to view the Admin Console.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.stop()

# Header (SVG only)
icon = get_svg("admin.svg", 28, 28)
st.markdown(
    f"""
    <div class="ds-page-head">
        <div class="ds-page-head-left">
            <div class="ds-page-icon">{icon}</div>
            <div class="ds-page-titles">
                <div class="ds-page-title">Admin Console</div>
                <div class="ds-page-subtitle">Manage users and monitor system health.</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# Tabs
tab1, tab2 = st.tabs(["User Management", "System Health"])

with tab1:
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Registered users</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>View user accounts and roles.</div>", unsafe_allow_html=True)

    users = list(db.db.users.find({}, {"password": 0}))
    df = pd.DataFrame(users) if users else pd.DataFrame()

    if df.empty:
        st.markdown("<div class='ds-empty-mini'>No users found.</div>", unsafe_allow_html=True)
    else:
        cols = [c for c in ["name", "email", "role", "created_at"] if c in df.columns]
        st.dataframe(df[cols], use_container_width=True, hide_index=True)

    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)

    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Grant admin access</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>Promote a user to Admin by email.</div>", unsafe_allow_html=True)

    with st.form("grant_admin", clear_on_submit=True):
        email = st.text_input("User Email", placeholder="name@company.com")
        a1, a2 = st.columns([1.2, 4.8])
        promote = a1.form_submit_button("Promote", type="primary", use_container_width=True)
        cancel = a2.form_submit_button("Cancel", type="secondary", use_container_width=True)

        if cancel:
            st.stop()

        if promote:
            email = (email or "").strip().lower()
            if not email or "@" not in email:
                st.error("Enter a valid email address.")
            else:
                res = db.db.users.update_one({"email": email}, {"$set": {"role": "Admin"}})
                if res.matched_count == 0:
                    st.error("No user found for that email.")
                else:
                    st.success("Admin access granted.")
                    st.rerun()

    st.markdown("</div>", unsafe_allow_html=True)

with tab2:
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>System health</div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-subtitle'>High-level stats from the database.</div>", unsafe_allow_html=True)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Users", db.db.users.count_documents({}))
    c2.metric("Tasks", db.db.tasks.count_documents({}))
    c3.metric("Projects", db.db.projects.count_documents({}))
    c4.metric("Workspaces", db.db.workspaces.count_documents({}))

    st.markdown("<div class='ds-divider'></div>", unsafe_allow_html=True)

    # Optional: quick view of latest users
    latest = list(db.db.users.find({}, {"password": 0}).sort("created_at", -1).limit(10))
    df2 = pd.DataFrame(latest) if latest else pd.DataFrame()

    st.markdown("<div class='ds-card-title' style='margin-top:6px;'>Recent signups</div>", unsafe_allow_html=True)
    if df2.empty:
        st.markdown("<div class='ds-empty-mini'>No recent users found.</div>", unsafe_allow_html=True)
    else:
        cols = [c for c in ["name", "email", "role", "created_at"] if c in df2.columns]
        st.dataframe(df2[cols], use_container_width=True, hide_index=True)

    st.markdown("</div>", unsafe_allow_html=True)

import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Inbox", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

db = DreamShiftDB()

# Auth guard
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

# Header (SVG only)
icon = get_svg("mail.svg", 28, 28)
st.markdown(
    f"""
    <div class="ds-page-head">
        <div class="ds-page-head-left">
            <div class="ds-page-icon">{icon}</div>
            <div class="ds-page-titles">
                <div class="ds-page-title">Inbox</div>
                <div class="ds-page-subtitle">Mentions, reminders, and alerts live here.</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# Data
notifs = db.get_unread_notifications(st.session_state.user_email) or []
count = len(notifs)

# Top summary bar
st.markdown(
    f"""
    <div class="ds-inbox-summary">
        <div class="ds-inbox-summary-left">
            <div class="ds-inbox-summary-k">Unread</div>
            <div class="ds-inbox-summary-v">{count}</div>
        </div>
        <div class="ds-inbox-summary-right">
            <div class="ds-inbox-summary-note">Stay on top of mentions, due dates, and admin alerts.</div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# Actions row
a1, a2 = st.columns([4.5, 1.5])
with a1:
    st.markdown(
        f"<div class='ds-muted'>You have <span class='ds-strong'>{count}</span> unread notifications.</div>",
        unsafe_allow_html=True,
    )

with a2:
    if st.button("Mark all read", disabled=(count == 0), use_container_width=True, type="primary"):
        for n in notifs:
            db.mark_notification_read(n["_id"])
        st.rerun()

st.markdown("<div class='ds-divider'></div>", unsafe_allow_html=True)

# Empty state
if count == 0:
    st.markdown(
        """
        <div class="ds-empty-state">
          <div class="ds-empty-title">Inbox zero</div>
          <div class="ds-empty-sub">You're all caught up. New notifications will show up here.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.stop()

# Render notifications
for n in notifs:
    n_id = n.get("_id")
    n_type = (n.get("type") or "info").lower()
    title = (n.get("title") or "Notification").strip()
    message = (n.get("message") or "").strip()

    ts = n.get("created_at")
    if isinstance(ts, (datetime.datetime, datetime.date)):
        ts_text = ts.strftime("%b %d, %I:%M %p") if isinstance(ts, datetime.datetime) else ts.strftime("%b %d, %Y")
        ts_text = ts_text.replace(" 0", " ")
    else:
        ts_text = ""

    # Visual severity
    is_warning = (n_type == "warning")
    badge = n_type.title()

    row_left, row_right = st.columns([6.0, 0.9])

    with row_left:
        st.markdown(
            f"""
            <div class="ds-inbox-item {'ds-inbox-item-warn' if is_warning else ''}">
                <div class="ds-inbox-item-top">
                    <div class="ds-inbox-item-title">{title}</div>
                    <span class="ds-pill ds-pill-ghost">{badge}</span>
                </div>
                <div class="ds-inbox-item-msg">{message}</div>
                <div class="ds-inbox-item-time">{ts_text}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with row_right:
        if st.button("Dismiss", key=f"dismiss_{n_id}", use_container_width=True, type="secondary"):
            db.mark_notification_read(n_id)
            st.rerun()

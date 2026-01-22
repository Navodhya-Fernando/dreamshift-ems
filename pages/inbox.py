import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Inbox", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()

db = DreamShiftDB()
icon = get_svg("mail.svg", 36, 36) or ":material/notifications:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Inbox</h1></div>""", unsafe_allow_html=True)

notifs = db.get_unread_notifications(st.session_state.user_email)

if not notifs:
    st.info("Inbox zero! No new notifications.")
else:
    if st.button("Mark all read"):
        for n in notifs: db.mark_notification_read(n['_id'])
        st.rerun()

    for n in notifs:
        bg = "rgba(246,185,0,0.15)" if n['type'] == 'warning' else "rgba(255,255,255,0.05)"
        st.markdown(f"""
        <div class="ds-card" style="background:{bg}; padding:15px; border-left:4px solid #f6b900;">
            <div style="font-weight:bold;">{n['title']}</div>
            <div style="opacity:0.8;">{n['message']}</div>
        </div>
        """, unsafe_allow_html=True)
        if st.button("Dismiss", key=str(n['_id'])):
            db.mark_notification_read(n['_id'])
            st.rerun()
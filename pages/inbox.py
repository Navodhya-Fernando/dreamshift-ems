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

col_h, col_act = st.columns([4, 1])
col_h.write(f"You have **{len(notifs)}** unread notifications.")

if col_act.button("Mark all read", disabled=len(notifs)==0):
    for n in notifs: db.mark_notification_read(n['_id'])
    st.rerun()

st.divider()

if not notifs:
    st.markdown("""<div style="text-align:center; padding:50px; opacity:0.6;">
        <h2>📭</h2><p>Inbox Zero! You're all caught up.</p>
    </div>""", unsafe_allow_html=True)

for n in notifs:
    # Warning style for important alerts, default for mentions
    border_color = "#d32f2f" if n['type'] == 'warning' else "#f6b900"
    bg_color = "rgba(211, 47, 47, 0.1)" if n['type'] == 'warning' else "rgba(255,255,255,0.05)"
    
    c1, c2 = st.columns([0.9, 0.1])
    with c1:
        st.markdown(f"""
        <div class="ds-card" style="background:{bg_color}; border-left:4px solid {border_color}; padding:15px; margin-bottom:10px;">
            <div style="font-weight:bold; font-size:1.1rem;">{n['title']}</div>
            <div style="color:#ddd; margin-top:5px;">{n['message']}</div>
            <div style="font-size:0.8rem; color:#888; margin-top:10px;">{n['created_at'].strftime('%Y-%m-%d %H:%M')}</div>
        </div>
        """, unsafe_allow_html=True)
    with c2:
        if st.button("✕", key=f"dismiss_{n['_id']}", help="Mark as read"):
            db.mark_notification_read(n['_id'])
            st.rerun()
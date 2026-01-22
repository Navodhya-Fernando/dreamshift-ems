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

summary_card = f"""
<div class="ds-card" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px;">
    <div>
        <div style="font-size:0.9rem; color:#cfcfcf;">Unread items</div>
        <div style="font-size:1.8rem; font-weight:800; color:#f6b900;">{len(notifs)}</div>
    </div>
    <div style="text-align:right;">
        <div style="font-size:0.85rem; color:#9ea0a6;">Stay on top of mentions, due dates, and alerts.</div>
    </div>
</div>
"""
st.markdown(summary_card, unsafe_allow_html=True)

col_h, col_act = st.columns([4, 1])
col_h.write(f"You have **{len(notifs)}** unread notifications.")

if col_act.button("Mark all read", disabled=len(notifs)==0, use_container_width=True):
    for n in notifs:
        db.mark_notification_read(n['_id'])
    st.rerun()

st.markdown("---")

if not notifs:
    st.markdown("""
    <div class="ds-card" style="text-align:center; padding:50px; opacity:0.65;">
        <div style="font-size:2rem;">📭</div>
        <div style="font-size:1.1rem; font-weight:700; margin-top:8px;">Inbox Zero</div>
        <div style="color:#b0b3b8; margin-top:4px;">You're all caught up. New alerts will land here.</div>
    </div>
    """, unsafe_allow_html=True)

for n in notifs:
    # Warning style for important alerts, default for mentions
    border_color = "#d32f2f" if n.get('type') == 'warning' else "#f6b900"
    bg_color = "rgba(211, 47, 47, 0.12)" if n.get('type') == 'warning' else "rgba(255,255,255,0.04)"
    ts = n.get('created_at')
    ts_text = ts.strftime('%Y-%m-%d %H:%M') if ts else ""
    title = n.get('title', 'Notification')
    message = n.get('message', '')
    notif_type = n.get('type', 'info').title()

    c1, c2 = st.columns([0.9, 0.1])
    with c1:
        st.markdown(f"""
        <div class="ds-card" style="background:{bg_color}; border-left:4px solid {border_color}; padding:15px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <div style="font-weight:800; font-size:1.05rem;">{title}</div>
                <span class="ds-pill" style="background:rgba(246,185,0,0.2); color:#f6b900;">{notif_type}</span>
            </div>
            <div style="color:#ddd; margin-top:6px; line-height:1.5;">{message}</div>
            <div style="font-size:0.8rem; color:#888; margin-top:10px;">{ts_text}</div>
        </div>
        """, unsafe_allow_html=True)
    with c2:
        if st.button("✕", key=f"dismiss_{n['_id']}", help="Mark as read", use_container_width=True):
            db.mark_notification_read(n['_id'])
            st.rerun()
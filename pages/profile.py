import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Profile", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

icon = get_svg("profile.svg", 36, 36) or ":material/person:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Profile</h1></div>""", unsafe_allow_html=True)

user = db.get_user(st.session_state.user_email)
stats = db.get_user_stats(st.session_state.user_email)

col1, col2 = st.columns([1, 2])

with col1:
    name = user.get('name', 'Member') if user else 'Member'
    email = user.get('email', 'Unknown') if user else 'unknown'
    role = user.get('role', 'Member') if user else 'Member'

    initial = (name or email)[0].upper() if (name or email) else "U"
    st.markdown(f"""
    <div class="ds-card" style="text-align:center;">
        <div class="ds-pill" style="width:48px; height:48px; border-radius:50%; margin:0 auto 10px auto; font-size:1.2rem;">{initial}</div>
        <h2 style="margin-bottom:4px;">{name}</h2>
        <p style="color:var(--text-muted); margin:0 0 8px 0;">{email}</p>
        <div class="ds-badge" style="margin:auto;">{role}</div>
    </div>
    """, unsafe_allow_html=True)
    
    if st.button("Log Out", use_container_width=True):
        st.session_state.clear()
        st.switch_page("pages/sign-in.py")

with col2:
    st.markdown("### Performance")
    c1, c2 = st.columns(2)
    c1.metric("Tasks Completed", stats.get('completed', 0))
    c2.metric("On-Time Rate", f"{stats.get('rate', 0)}%")
    
    st.markdown("### Account Security")
    sec_left, sec_right = st.columns([0.4, 0.6])
    with sec_left:
        st.markdown("""
        <div class="ds-card" style="padding:14px;">
            <div style="font-weight:700;">Password</div>
            <div style="color:#888; font-size:0.9rem;">Last changed: Recently</div>
        </div>
        """, unsafe_allow_html=True)
    with sec_right:
        if st.button("Reset Password", use_container_width=True):
            st.switch_page("pages/password-reset.py")
    
    st.markdown("### Preferences")
    st.markdown("""
    <div class="ds-card" style="padding:14px;">
        <div style="font-weight:700; margin-bottom:6px;">Notifications</div>
        <div style="color:#9ea0a6;">Mentions, reminders, and admin alerts will appear in Inbox. Email digests coming soon.</div>
    </div>
    """, unsafe_allow_html=True)
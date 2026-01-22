import streamlit as st
import datetime
import html
from src.database import DreamShiftDB

st.set_page_config(page_title="Profile", page_icon="👤", layout="wide", initial_sidebar_state="expanded")

# Load UI utilities
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

# Hide default Streamlit sidebar
hide_streamlit_sidebar()

# Render custom sidebar
render_custom_sidebar()

# Load global CSS
load_global_css()

db = DreamShiftDB()

# Auth
if "user_email" not in st.session_state:
    st.error("Please login first")
    st.stop()

user_email = st.session_state.user_email
user = db.get_user(user_email) or {}
stats = db.get_user_stats(user_email) or {}

def safe(x):
    return html.escape(str(x)) if x is not None else ""

def fmt_date(dt, fmt="%B %d, %Y"):
    try:
        if isinstance(dt, datetime.datetime):
            return dt.strftime(fmt)
        elif isinstance(dt, datetime.date):
            return dt.strftime(fmt)
        elif isinstance(dt, str):
            return datetime.datetime.fromisoformat(dt).strftime(fmt)
        return "N/A"
    except Exception:
        return "N/A"

def fmt_time(dt):
    try:
        return dt.strftime("%b %d, %I:%M %p")
    except Exception:
        return "N/A"

name = user.get("name", "User")
created_at = user.get("created_at")
member_since = fmt_date(created_at) if created_at else "N/A"

profile = user.get("profile", {})
photo_url = profile.get("photo_url", "")
role_title = profile.get("role_title", "")
date_joined = profile.get("date_joined", None)

# Header (minimal)
st.markdown(
    f"""
    <div class="p-header">
      <div class="p-left">
        <div class="p-avatar">{safe(name)[:1].upper()}</div>
        <div style="min-width:0;">
          <div class="p-title">{safe(name)}</div>
          <div class="p-sub">{safe(user.get("email",""))}<span class="p-dot">•</span>Member since {member_since}</div>
        </div>
      </div>
      <div class="p-actions">
        <div class="p-chip">Profile</div>
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

# Profile header with photo
left, right = st.columns([3, 2])

with left:
    st.markdown('<div class="custom-card" style="padding:18px;">', unsafe_allow_html=True)
    a, b = st.columns([1, 4])

    with a:
        if photo_url:
            try:
                st.image(photo_url, width=78)
            except:
                initials = (user.get("name", "U")[:1] or "U").upper()
                st.markdown(f"""
                <div style="width:78px; height:78px; border-radius:16px; background:rgba(246,185,0,0.18);
                            display:flex; align-items:center; justify-content:center; border:1px solid rgba(246,185,0,0.35);">
                    <div style="font-size:28px; font-weight:700; color:#f6b900;">{initials}</div>
                </div>
                """, unsafe_allow_html=True)
        else:
            initials = (user.get("name", "U")[:1] or "U").upper()
            st.markdown(f"""
            <div style="width:78px; height:78px; border-radius:16px; background:rgba(246,185,0,0.18);
                        display:flex; align-items:center; justify-content:center; border:1px solid rgba(246,185,0,0.35);">
                <div style="font-size:28px; font-weight:700; color:#f6b900;">{initials}</div>
            </div>
            """, unsafe_allow_html=True)

    with b:
        st.markdown(f"""
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:20px; font-weight:700; color:#ffffff;">{user.get('name','')}</div>
          <div style="color:rgba(255,255,255,0.70); font-size:14px;">{user.get('email','')}</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
            <div style="padding:6px 10px; border:1px solid rgba(255,255,255,0.12); border-radius:10px; color:rgba(255,255,255,0.75); font-size:12px;">
              Role: <span style="color:#ffffff; font-weight:600;">{role_title or "Not set"}</span>
            </div>
            <div style="padding:6px 10px; border:1px solid rgba(255,255,255,0.12); border-radius:10px; color:rgba(255,255,255,0.75); font-size:12px;">
              Joined: <span style="color:#ffffff; font-weight:600;">{fmt_date(date_joined)}</span>
            </div>
          </div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)

with right:
    st.markdown('<div class="custom-card" style="padding:18px;">', unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    c1.metric("Assigned", stats.get("assigned", 0))
    c2.metric("Completed", stats.get("completed", 0))
    c3, c4 = st.columns(2)
    c3.metric("Completion", f"{stats.get('rate', 0)}%")
    c4.metric("Hours", f"{stats.get('total_hours', 0)}h")
    st.markdown("</div>", unsafe_allow_html=True)

st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)

tab_overview, tab_activity, tab_security = st.tabs(["Overview", "Activity", "Security"])

with tab_overview:
    st.markdown('<div class="custom-card" style="padding:18px;">', unsafe_allow_html=True)
    st.markdown("#### Quick details")
    col1, col2 = st.columns(2)
    col1.write(f"Account created: {fmt_date(created_at)}")
    col2.write(f"Workspace role: {st.session_state.get('user_role','Employee')}")
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown('<div class="custom-card" style="padding:18px;">', unsafe_allow_html=True)
    st.markdown("#### My tasks snapshot")
    tasks = db.get_tasks_with_urgency({"assignee": user_email}) or []
    todo = len([t for t in tasks if t.get("status") == "To Do"])
    inprog = len([t for t in tasks if t.get("status") == "In Progress"])
    blocked = len([t for t in tasks if t.get("status") == "Blocked"])
    st.write(f"To Do: {todo}")
    st.write(f"In Progress: {inprog}")
    st.write(f"Blocked: {blocked}")
    st.markdown("</div>", unsafe_allow_html=True)

with tab_activity:
    st.markdown('<div class="custom-card" style="padding:18px;">', unsafe_allow_html=True)
    st.markdown("#### Recent time logs")
    entries = (db.get_user_time_entries(user_email) or [])[:15]
    if not entries:
        st.info("No time logs yet.")
    else:
        for e in entries:
            task = db.get_task(e.get("task_id"))
            if not task:
                continue
            mins = int(e.get("duration", 0) // 60)
            ts = fmt_time(e.get("timestamp"))
            st.markdown(f"""
            <div style="padding:12px; border:1px solid rgba(255,255,255,0.10); border-radius:12px; margin-bottom:8px;">
              <div style="display:flex; justify-content:space-between; gap:10px;">
                <div style="color:#ffffff; font-weight:600;">{safe(task.get('title',''))}</div>
                <div style="color:#f6b900; font-weight:700;">{mins}m</div>
              </div>
              <div style="color:rgba(255,255,255,0.60); font-size:12px; margin-top:4px;">{ts}</div>
            </div>
            """, unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

with tab_security:
    st.markdown('<div class="custom-card" style="padding:18px;">', unsafe_allow_html=True)
    st.markdown("#### Account information")
    st.info("📧 To change your email address, contact your workspace administrator.")
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown('<div class="custom-card" style="padding:18px; margin-top:12px;">', unsafe_allow_html=True)
    st.markdown("#### Change password")

    with st.form("change_password_form"):
        old_pw = st.text_input("Current password", type="password", key="old_pw")
        new_pw = st.text_input("New password", type="password", key="new_pw")
        confirm_pw = st.text_input("Confirm new password", type="password", key="confirm_pw")

        col_btn, col_spacer = st.columns([1, 8])
        with col_btn:
            submitted_pw = st.form_submit_button("Update password", use_container_width=True)
        
        if submitted_pw:
            if not old_pw or not new_pw or not confirm_pw:
                st.error("Please fill all fields.")
            elif not db.verify_user_password(user_email, old_pw):
                st.error("Incorrect current password.")
            elif new_pw != confirm_pw:
                st.error("New passwords do not match.")
            elif len(new_pw) < 8:
                st.error("Password must be at least 8 characters.")
            elif new_pw == old_pw:
                st.error("New password must be different.")
            else:
                db.update_password(user_email, new_pw)
                st.success("✅ Password updated successfully.")
    st.markdown("</div>", unsafe_allow_html=True)

st.markdown("<div class='p-footer'>Need help? Contact your workspace admin.</div>", unsafe_allow_html=True)



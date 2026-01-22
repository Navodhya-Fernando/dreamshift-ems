import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.ui import load_global_css, render_custom_sidebar, get_svg

st.set_page_config(page_title="Home", page_icon="static/icons/home.svg", layout="wide")
render_custom_sidebar()
load_global_css()

db = DreamShiftDB()

if "user_email" not in st.session_state: st.switch_page("pages/sign-in.py")

# --- AUTO-CHECK DEADLINES (Inbox Notification Only) ---
if "deadline_checked" not in st.session_state:
    tasks = db.get_tasks_with_urgency({
        "assignee": st.session_state.user_email, 
        "status": {"$ne": "Completed"}
    })
    for t in tasks:
        # If task is Overdue (Red) or Urgent (Orange)
        if t.get('urgency_color') in ["#d32f2f", "#f57c00"]:
             # Send to INBOX only (No Email)
             db.create_notification(
                 st.session_state.user_email, 
                 "Deadline Alert", 
                 f"Task '{t['title']}' is due on {t.get('due_date').strftime('%Y-%m-%d') if t.get('due_date') else 'No Date'}.", 
                 "warning"
             )
    st.session_state['deadline_checked'] = True

# --- HERO SECTION ---
# Using Custom SVG for the main icon
icon_html = get_svg("home.svg", 38, 38) or ":material/home:"

# Time-based greeting without emojis
hour = datetime.datetime.now().hour
greeting = "Good Morning" if hour < 12 else "Good Afternoon" if hour < 18 else "Good Evening"

st.markdown(f"""
<div class="ds-header-flex">
    {icon_html}
    <h1 class="ds-header-title">{greeting}, {st.session_state.get('user_name', 'User')}</h1>
</div>
""", unsafe_allow_html=True)

st.markdown("---")

# --- MY WORK SECTION ---
c1, c2 = st.columns([2, 1])

with c1:
    st.subheader("📝 My Priorities")
    # Get high priority or urgent tasks
    my_tasks = db.get_tasks_with_urgency({
        "assignee": st.session_state.user_email, 
        "status": {"$ne": "Completed"}
    })
    
    if not my_tasks:
        st.success("You are all caught up!")
    
    for t in my_tasks[:5]: # Top 5
        color = t.get('urgency_color', '#4caf50')
        st.markdown(f"""
        <div class="ds-card" style="border-left: 5px solid {color}; padding: 10px 15px; margin-bottom: 10px;">
            <div style="font-weight: 600; font-size: 1.1rem;">{t['title']}</div>
            <div style="display:flex; justify-content:space-between; font-size: 0.9rem; color: #888;">
                <span>📅 Due: {t.get('due_date').strftime('%b %d') if t.get('due_date') else 'No Date'}</span>
                <span style="color:{color}">● {t['priority']}</span>
            </div>
        </div>
        """, unsafe_allow_html=True)
        if st.button(f"Open Task", key=f"home_{t['_id']}"):
            st.session_state.selected_task_id = str(t['_id'])
            st.switch_page("pages/task-details.py")

with c2:
    st.subheader("📢 Recent Inbox")
    notifs = db.get_unread_notifications(st.session_state.user_email)
    if not notifs:
        st.info("No new notifications.")
    else:
        for n in notifs[:3]:
            st.warning(f"**{n['title']}**: {n['message']}")
        if st.button("View Inbox"): st.switch_page("pages/inbox.py")
import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg
from src.mailer import notify_deadline_warning

st.set_page_config(page_title="Home", page_icon="static/icons/home.svg", layout="wide")
hide_streamlit_sidebar()
render_custom_sidebar()
load_global_css()

db = DreamShiftDB()

if "user_email" not in st.session_state: st.switch_page("pages/sign-in.py")

# --- AUTO-CHECK DEADLINES (Runs on page load) ---
due_soon = db.check_24h_deadlines()
for t in due_soon:
    notify_deadline_warning(t['assignee'], t['title'], t['due_date'])

# --- HERO ---
icon = get_svg("home.svg", 38, 38) or ":material/home:"
hour = datetime.datetime.now().hour
greeting = "Good Morning" if hour < 12 else "Good Afternoon" if hour < 18 else "Good Evening"

st.markdown(f"""
<div class="ds-header-flex">
    {icon}
    <h1 class="ds-header-title">{greeting}, {st.session_state.get('user_name', 'User')}</h1>
</div>
""", unsafe_allow_html=True)

# --- METRICS ---
col1, col2, col3 = st.columns(3)
# (Add your metrics logic here using db.get_user_stats if available, using placeholder for brevity)
with col1: st.metric("Tasks Due", "3")
with col2: st.metric("Pending Review", "1")
with col3: st.metric("Hours Tracked", "4.5h")

st.info("💡 Pro Tip: Check your Inbox for new mentions and alerts.")
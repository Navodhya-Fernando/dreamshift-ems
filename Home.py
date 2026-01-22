import streamlit as st
import datetime
import streamlit.components.v1 as components
from src.database import DreamShiftDB
from src.ui import load_global_css, render_custom_sidebar, get_svg

# Page Config
st.set_page_config(page_title="Home", page_icon="static/icons/home.svg", layout="wide")
render_custom_sidebar()
load_global_css()

db = DreamShiftDB()

# Auth Check
if "user_email" not in st.session_state: 
    st.switch_page("pages/sign-in.py")

# --- LOGIC: DEADLINE CHECKER (Inbox Only - No Email) ---
if "deadline_checked" not in st.session_state:
    try:
        tasks = db.get_tasks_with_urgency({
            "assignee": st.session_state.user_email, 
            "status": {"$ne": "Completed"}
        })
        for t in tasks:
            # If task is Overdue (Red) or Urgent (Orange)
            if t.get('urgency_color') in ["#d32f2f", "#f57c00"]:
                # Check for existing unread notification to avoid spam
                existing = db.db.notifications.find_one({
                    "user_email": st.session_state.user_email,
                    "title": "Deadline Alert",
                    "link": f"task:{t['_id']}",
                    "read": False
                })
                
                if not existing:
                    # Create Inbox Notification (No Email)
                    db.create_notification(
                        st.session_state.user_email, 
                        "Deadline Alert", 
                        f"Task '{t['title']}' is due soon ({t.get('due_date').strftime('%Y-%m-%d')}).", 
                        "warning",
                        link=f"task:{t['_id']}"
                    )
        st.session_state['deadline_checked'] = True
    except Exception as e:
        print(f"Deadline check skipped: {e}")

# --- CLIENT-SIDE GREETING (Timezone Aware) ---
# We use HTML/JS to detect the user's local time (Morning/Evening/Night)
# and render the appropriate SVG icon instantly.

user_name = st.session_state.get('user_name', 'User')

# Define SVGs inline to ensure they work without file dependencies
svg_morning = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f6b900" width="48" height="48"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 9c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>"""

svg_evening = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f6b900" width="48" height="48"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>"""

svg_night = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f6b900" width="48" height="48"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>"""

# Inject CSS styles for the greeting component
greeting_styles = """
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
    body { margin: 0; background: #24101a; font-family: 'Inter', sans-serif; }
    .ds-greeting-container {
        display: flex;
        align-items: center;
        gap: 15px;
        color: white;
        padding-bottom: 20px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        animation: fadeIn 0.8s ease-out;
    }
    .ds-greeting-text h1 {
        font-size: 32px;
        font-weight: 800;
        margin: 0;
        line-height: 1.2;
    }
    .ds-greeting-sub {
        font-size: 16px;
        color: rgba(255,255,255,0.7);
        margin: 0;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
"""

# JavaScript to detect time and inject correct SVG/Text
greeting_html = f"""
{greeting_styles}
<div class="ds-greeting-container">
    <div id="greeting-icon"></div>
    <div class="ds-greeting-text">
        <h1 id="greeting-title">Hello, {user_name}</h1>
        <p class="ds-greeting-sub">Let's be productive today.</p>
    </div>
</div>

<script>
    const hour = new Date().getHours();
    const iconDiv = document.getElementById("greeting-icon");
    const titleDiv = document.getElementById("greeting-title");
    
    let greeting = "Good Morning";
    let svg = \`{svg_morning}\`;
    
    if (hour >= 5 && hour < 12) {{
        greeting = "Good Morning";
        svg = \`{svg_morning}\`;
    }} else if (hour >= 12 && hour < 17) {{
        greeting = "Good Afternoon";
        svg = \`{svg_evening}\`;
    }} else if (hour >= 17 && hour < 21) {{
        greeting = "Good Evening";
        svg = \`{svg_evening}\`;
    }} else {{
        greeting = "Good Night";
        svg = \`{svg_night}\`;
    }}
    
    titleDiv.innerText = greeting + ", {user_name}";
    iconDiv.innerHTML = svg;
</script>
"""

# Render the greeting component with explicit height
components.html(greeting_html, height=100)

# --- METRICS ---
stats = db.get_user_stats(st.session_state.user_email)
col1, col2, col3 = st.columns(3)

# Custom metric styling
def render_metric(label, value, delta=None, color="#f6b900"):
    st.markdown(f"""
    <div class="ds-card" style="padding: 15px; text-align: center; border: 1px solid rgba(255,255,255,0.05); background: #24101a;">
        <div style="font-size: 0.9rem; color: #888; text-transform: uppercase; letter-spacing: 1px;">{label}</div>
        <div style="font-size: 2.2rem; font-weight: 800; color: {color}; margin: 5px 0;">{value}</div>
        {f'<div style="font-size: 0.8rem; color: #4caf50;">{delta}</div>' if delta else ''}
    </div>
    """, unsafe_allow_html=True)

with col1:
    render_metric("Active Tasks", stats['assigned'], "Current Workload")
with col2:
    render_metric("Completion Rate", f"{stats['rate']}%", "Productivity")
with col3:
    entries = db.db.time_entries.find({"user_email": st.session_state.user_email})
    total_hours = sum(e.get('seconds', 0) for e in entries) / 3600
    render_metric("Hours Logged", f"{total_hours:.1f}h", color="#4caf50")

st.markdown("---")

# --- MY WORK SECTION ---
c1, c2 = st.columns([2, 1])

with c1:
    st.subheader("📝 My Priorities")
    my_tasks = db.get_tasks_with_urgency({
        "assignee": st.session_state.user_email, 
        "status": {"$ne": "Completed"}
    })
    
    if not my_tasks:
        st.markdown("""
            <div class="ds-card" style="text-align:center; padding:30px; opacity:0.7; background: #24101a;">
            <h3>🎉 All Caught Up!</h3>
            <p>You have no pending tasks.</p>
        </div>
        """, unsafe_allow_html=True)
    
    for t in my_tasks[:5]:
        color = t.get('urgency_color', '#4caf50')
        st.markdown(f"""
            <div class="ds-card" style="border-left: 5px solid {color}; padding: 12px 15px; margin-bottom: 10px; transition: transform 0.2s; background: #24101a;">
            <div style="font-weight: 600; font-size: 1.1rem; display:flex; justify-content:space-between; align-items:center;">
                <span>{t['title']}</span>
                <span class="ds-badge" style="font-size:0.75rem; background:rgba(255,255,255,0.1);">{t['priority']}</span>
            </div>
            <div style="font-size: 0.85rem; color: #999; margin-top:5px; display:flex; gap:15px;">
                <span>📅 {t.get('due_date').strftime('%b %d') if t.get('due_date') else 'No Date'}</span>
                <span>📂 {t.get('status')}</span>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        if st.button(f"Open Task", key=f"home_{t['_id']}"):
            st.session_state.selected_task_id = str(t['_id'])
            st.switch_page("pages/task-details.py")

with c2:
    st.subheader("🔔 Recent Inbox")
    notifs = db.get_unread_notifications(st.session_state.user_email)
    
    if not notifs:
        st.info("No new notifications.")
    else:
        for n in notifs[:4]:
            border = "#d32f2f" if n['type'] == 'warning' else "#f6b900"
            st.markdown(f"""
                <div style="background: #24101a; border-radius: 8px; padding: 10px; margin-bottom: 8px; border-left: 3px solid {border};">
                <div style="font-weight: 600; font-size: 0.9rem;">{n['title']}</div>
                <div style="font-size: 0.8rem; color: #aaa; margin-top: 2px;">{n['message']}</div>
            </div>
            """, unsafe_allow_html=True)
        
        if st.button("Go to Inbox", use_container_width=True): 
            st.switch_page("pages/inbox.py")

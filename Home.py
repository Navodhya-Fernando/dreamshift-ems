import streamlit as st
import streamlit as st
import datetime
import streamlit.components.v1 as components
from src.database import DreamShiftDB
from src.ui import load_global_css, render_custom_sidebar

# Page Config
st.set_page_config(page_title="Home", page_icon="static/icons/home.svg", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()

db = DreamShiftDB()

# Auth Check
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

# -----------------------------
# LOGIC: DEADLINE CHECKER (Inbox Only - No Email)
# -----------------------------
if "deadline_checked" not in st.session_state:
    try:
        tasks = db.get_tasks_with_urgency(
            {"assignee": st.session_state.user_email, "status": {"$ne": "Completed"}}
        )
        for t in tasks:
            # If task is Overdue (Red) or Urgent (Orange)
            if t.get("urgency_color") in ["#d32f2f", "#f57c00"]:
                existing = db.db.notifications.find_one(
                    {
                        "user_email": st.session_state.user_email,
                        "title": "Deadline Alert",
                        "link": f"task:{t['_id']}",
                        "read": False,
                    }
                )
                if not existing:
                    db.create_notification(
                        st.session_state.user_email,
                        "Deadline Alert",
                        f"Task '{t['title']}' is due soon ({t.get('due_date').strftime('%Y-%m-%d')}).",
                        "warning",
                        link=f"task:{t['_id']}",
                    )
        st.session_state["deadline_checked"] = True
    except Exception as e:
        print(f"Deadline check skipped: {e}")

# -----------------------------
# HEADER: GREETING (Timezone Aware)
# No emojis. Uses your theme classes (CSS will be finalized later).
# -----------------------------
user_name = st.session_state.get("user_name", "User")

# Minimal greeting HTML (icon swaps via JS, uses your palette)
svg_morning = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f6b900" width="44" height="44"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 9c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>"""
svg_evening = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f6b900" width="44" height="44"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>"""
svg_night = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f6b900" width="44" height="44"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>"""

greeting_html = f"""
<div class="ds-home-header">
  <div class="ds-home-greeting">
    <div id="ds_greeting_icon" class="ds-home-greeting-icon"></div>
    <div class="ds-home-greeting-text">
      <div id="ds_greeting_title" class="ds-home-title">Hello, {user_name}</div>
      <div class="ds-home-subtitle">Your work, organized. Keep it moving.</div>
    </div>
  </div>
</div>

<script>
  const hour = new Date().getHours();
  const iconDiv = document.getElementById("ds_greeting_icon");
  const titleDiv = document.getElementById("ds_greeting_title");

  let greeting = "Hello";
  let svg = `{svg_morning}`;

  if (hour >= 5 && hour < 12) {{
    greeting = "Good Morning";
    svg = `{svg_morning}`;
  }} else if (hour >= 12 && hour < 17) {{
    greeting = "Good Afternoon";
    svg = `{svg_evening}`;
  }} else if (hour >= 17 && hour < 21) {{
    greeting = "Good Evening";
    svg = `{svg_evening}`;
  }} else {{
    greeting = "Good Night";
    svg = `{svg_night}`;
  }}

  titleDiv.innerText = greeting + ", {user_name}";
  iconDiv.innerHTML = svg;
</script>
"""

# Render header component
components.html(greeting_html, height=110)

# -----------------------------
# STATS / METRICS
# -----------------------------
stats = db.get_user_stats(st.session_state.user_email)

# Hours logged
entries = db.db.time_entries.find({"user_email": st.session_state.user_email})
total_hours = sum(e.get("seconds", 0) for e in entries) / 3600

m1, m2, m3 = st.columns(3)

def render_kpi(label: str, value: str, hint: str | None = None):
    hint_html = f"<div class='ds-kpi-hint'>{hint}</div>" if hint else ""
    st.markdown(
        f"""
        <div class="ds-kpi">
          <div class="ds-kpi-label">{label}</div>
          <div class="ds-kpi-value">{value}</div>
          {hint_html}
        </div>
        """,
        unsafe_allow_html=True,
    )

with m1:
    render_kpi("Active Tasks", str(stats.get("assigned", 0)), "Current workload")
with m2:
    render_kpi("Completion Rate", f"{stats.get('rate', 0)}%", "Last 30 days")
with m3:
    render_kpi("Hours Logged", f"{total_hours:.1f}h", "Tracked time")

st.markdown('<div class="ds-divider"></div>', unsafe_allow_html=True)

# -----------------------------
# MAIN GRID: Priorities + Inbox
# -----------------------------
left, right = st.columns([2.2, 1])

# --- LEFT: My Priorities ---
with left:
    st.markdown('<div class="ds-section-title">My Priorities</div>', unsafe_allow_html=True)

    my_tasks = db.get_tasks_with_urgency(
        {"assignee": st.session_state.user_email, "status": {"$ne": "Completed"}}
    )

    if not my_tasks:
        st.markdown(
            """
            <div class="ds-empty-state">
              <div class="ds-empty-title">All caught up</div>
              <div class="ds-empty-sub">No pending tasks right now.</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        for t in my_tasks[:5]:
            urgency_color = t.get("urgency_color", "#4caf50")
            due_str = t.get("due_date").strftime("%b %d") if t.get("due_date") else "No date"
            priority = t.get("priority", "Medium")
            status = t.get("status", "Open")
            title = t.get("title", "Untitled")

            st.markdown(
                f"""
                <div class="ds-task-row" style="border-left: 4px solid {urgency_color};">
                  <div class="ds-task-row-top">
                    <div class="ds-task-title">{title}</div>
                    <div class="ds-pill">{priority}</div>
                  </div>
                  <div class="ds-task-row-meta">
                    <div class="ds-task-meta-item">Due: {due_str}</div>
                    <div class="ds-task-meta-dot"></div>
                    <div class="ds-task-meta-item">{status}</div>
                  </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            if st.button("Open Task", key=f"home_open_{t['_id']}", use_container_width=False):
                st.session_state.selected_task_id = str(t["_id"])
                st.switch_page("pages/task-details.py")

# --- RIGHT: Recent Inbox ---
with right:
    st.markdown('<div class="ds-section-title">Recent Inbox</div>', unsafe_allow_html=True)

    notifs = db.get_unread_notifications(st.session_state.user_email)

    if not notifs:
        st.markdown("<div class='ds-empty-mini'>No new notifications.</div>", unsafe_allow_html=True)
    else:
        for n in notifs[:4]:
            ntype = n.get("type", "info")
            border = "#d32f2f" if ntype == "warning" else "#f6b900"
            title = n.get("title", "Notification")
            msg = n.get("message", "")

            st.markdown(
                f"""
                <div class="ds-notif" style="border-left: 3px solid {border};">
                  <div class="ds-notif-title">{title}</div>
                  <div class="ds-notif-msg">{msg}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        if st.button("Go to Inbox", use_container_width=True, key="home_inbox_btn"):
            st.switch_page("pages/inbox.py")

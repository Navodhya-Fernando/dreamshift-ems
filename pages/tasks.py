import streamlit as st
import datetime
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Tasks", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

icon = get_svg("tasks.svg", 36, 36) or ":material/check_circle:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Tasks</h1></div>""", unsafe_allow_html=True)

ws_id = st.session_state.get("current_ws_id")
if not ws_id: 
    st.warning("Select a workspace.")
    st.stop()

# Workspace member options (names, not emails)
members = db.get_workspace_members(ws_id)
member_display = []
member_lookup = {}
for m in members:
    name = m.get("name") or m.get("email")
    email = m.get("email")
    if name and email:
        display = name
        if display in member_lookup:
            display = f"{name} ({email})"
        member_display.append(display)
        member_lookup[display] = email
default_assignee = None
for disp, email in member_lookup.items():
    if email == st.session_state.user_email:
        default_assignee = disp
        break

# --- CONTROLS ---
col_filter, col_add = st.columns([3, 1])
with col_filter:
    statuses = db.get_workspace_statuses(ws_id)
    filter_status = st.selectbox("Status Filter", ["All", "Active"] + statuses)

with col_add:
    with st.popover("➕ New Task"):
        with st.form("quick_add_task"):
            title = st.text_input("Task Title")
            assignee_display = st.selectbox("Assignee", member_display or ["Unassigned"], index=member_display.index(default_assignee) if default_assignee in member_display else 0)
            date = st.date_input("Due Date")
            priority = st.selectbox("Priority", ["Low", "Medium", "High", "Urgent"])
            if st.form_submit_button("Create"):
                assignee_email = member_lookup.get(assignee_display)
                db.create_task(ws_id, title, "", date, assignee_email, "To Do", priority, None, st.session_state.user_email)
                st.success("Created!")
                st.rerun()

# --- QUERY ---
query = {"workspace_id": ws_id}
if filter_status != "All":
    if filter_status == "Active":
        query["status"] = {"$ne": "Completed"}
    else:
        query["status"] = filter_status

tasks = db.get_tasks_with_urgency(query)

# --- LIST VIEW ---
st.markdown("### Task List")
if not tasks:
    st.info("No tasks found matching this filter.")

for t in tasks:
    urgency = t.get('urgency_color', '#ccc')
    assignee_email = t.get('assignee')
    assignee_display = next((d for d, em in member_lookup.items() if em == assignee_email), assignee_email or 'Unassigned')
    
    # Card Layout
    c1, c2, c3, c4 = st.columns([4, 2, 2, 1])
    with c1:
        st.markdown(f"**{t['title']}**")
        st.caption(f"Assignee: {assignee_display}")
    with c2:
        st.markdown(f"<span style='color:{urgency}'>● {t.get('due_date').strftime('%b %d') if t.get('due_date') else 'No Date'}</span>", unsafe_allow_html=True)
    with c3:
        st.markdown(f"<span class='ds-badge'>{t['status']}</span>", unsafe_allow_html=True)
    with c4:
        if st.button("Open", key=f"list_{t['_id']}"):
            st.session_state.selected_task_id = str(t['_id'])
            st.switch_page("pages/task-details.py")
    st.divider()
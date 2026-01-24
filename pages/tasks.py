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
    st.warning("Please select a workspace from the sidebar.")
    st.stop()

# --- FETCH MEMBERS FOR ASSIGNEE DROPDOWN ---
members = db.get_workspace_members(ws_id)
member_display = []
member_lookup = {}
for m in members:
    name = m.get("name") or m.get("email")
    email = m.get("email")
    if name and email:
        display = name
        # Handle duplicate names
        if display in member_lookup:
            display = f"{name} ({email})"
        member_display.append(display)
        member_lookup[display] = email

# Default assignee is current user
default_assignee_idx = 0
if st.session_state.user_email in member_lookup.values():
    current_user_name = next(name for name, email in member_lookup.items() if email == st.session_state.user_email)
    if current_user_name in member_display:
        default_assignee_idx = member_display.index(current_user_name)

# --- BETTER TASK CREATION FORM ---
with st.expander("Create New Task", expanded=False):
    with st.form("create_task_form"):
        c1, c2 = st.columns([2, 1])
        with c1:
            task_name = st.text_input("Task Name", placeholder="e.g. Fix Navigation Bar")
        with c2:
            priority = st.selectbox("Priority", ["Low", "Medium", "High", "Critical"], index=1)
            
        c3, c4 = st.columns(2)
        with c3:
            assignee = st.selectbox("Assignee", member_display or ["Unassigned"], index=default_assignee_idx)
        with c4:
            due_date = st.date_input("Due Date", value=datetime.date.today() + datetime.timedelta(days=1))
            
        if st.form_submit_button("Create Task", type="primary", use_container_width=True):
            if not task_name:
                st.error("Task Name is required.")
            else:
                assignee_email = member_lookup.get(assignee)
                db.create_task(
                    ws_id=ws_id,
                    title=task_name,
                    desc="", # Description is optional/empty initially
                    due_date=due_date,
                    assignee=assignee_email,
                    status="To Do",
                    priority=priority,
                    project_id=None,
                    creator=st.session_state.user_email
                )
                st.success("Task created!")
                st.rerun()

# --- TASK LIST (Kanban/List Hybrid) ---
st.markdown("### Active Tasks")

tasks = db.get_tasks_with_urgency({"workspace_id": ws_id, "status": {"$ne": "Completed"}})

if not tasks:
    st.info("No active tasks in this workspace.")

for t in tasks:
    urgency_color = t.get('urgency_color', '#ccc')
    
    # Clean card layout
    st.markdown(f"""
    <div class="ds-card" style="padding: 16px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div style="flex-grow: 1;">
            <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 4px; color: #f6b900;">{t['title']}</div>
            <div class="ds-meta">
                <span class="ds-meta-item">Assignee: {next((k for k,v in member_lookup.items() if v == t.get('assignee')), 'Unassigned')}</span>
                <span class="ds-meta-item" style="border-color:{urgency_color}; color:{urgency_color};">Due: {t.get('due_date').strftime('%b %d') if t.get('due_date') else 'No Date'}</span>
                <span class="ds-meta-item">Priority: {t.get('priority')}</span>
            </div>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
            <span class="ds-badge">{t['status']}</span>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    # Invisible button overlay logic usually requires trickier CSS or just placing a button below/beside
    # For Streamlit, placing the button explicitly is safer
    col_btn = st.columns([0.9, 0.1])
    with col_btn[1]:
        if st.button("Open", key=f"open_{t['_id']}", help="Open Details"):
            st.session_state.selected_task_id = str(t['_id'])
            st.switch_page("pages/task-details.py")
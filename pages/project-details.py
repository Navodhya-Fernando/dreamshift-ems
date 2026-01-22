import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar
from src.chat_ui import render_comment

st.set_page_config(page_title="Project Details", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

pid = st.session_state.get("selected_project_id")
if not pid: st.switch_page("pages/projects.py")

proj = db.db.projects.find_one({"_id": db.ObjectId(pid)})

# --- HEADER ---
c1, c2 = st.columns([1, 6])
if c1.button("← Back"): st.switch_page("pages/projects.py")
c2.markdown(f"# 📂 {proj['name']}")
st.markdown(f"*{proj.get('description')}*")

st.divider()

# --- ADD TASK TO PROJECT ---
with st.expander("Add Task to Project"):
    with st.form("add_p_task"):
        t_title = st.text_input("Task Title")
        members = db.get_workspace_members(proj['workspace_id'])
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
        default_assignee = next((d for d, em in member_lookup.items() if em == st.session_state.user_email), None)
        t_assignee = st.selectbox("Assignee", member_display or ["Unassigned"], index=member_display.index(default_assignee) if default_assignee in member_display else 0)
        if st.form_submit_button("Add Task"):
            db.create_task(proj['workspace_id'], t_title, "", None, member_lookup.get(t_assignee), "To Do", "Medium", pid, st.session_state.user_email)
            st.rerun()

# --- PROJECT TASKS ---
tasks = db.get_tasks_with_urgency({"project_id": pid})

if not tasks:
    st.info("No tasks in this project yet.")
else:
    for t in tasks:
        col1, col2, col3 = st.columns([4, 2, 1])
        col1.write(f"**{t['title']}**")
        col2.caption(t['status'])
        if col3.button("View", key=f"p_{t['_id']}"):
            st.session_state.selected_task_id = str(t['_id'])
            st.switch_page("pages/task-details.py")

# --- PROJECT DISCUSSION ---
st.markdown("---")
st.markdown("## Discussion")
comments = db.get_comments("project", pid)

# Render comments
for c in comments:
    render_comment(
        c,
        current_user_email=st.session_state.user_email,
        can_pin=True,
        db=db,
        entity_type="project",
        entity_id=pid,
        workspace_id=proj['workspace_id'],
        project_id=pid,
        task_id=None
    )

with st.form("project_comment"):
    txt = st.text_area("Write a comment (@mention teammates by name)...")
    if st.form_submit_button("Post Comment"):
        if txt:
            db.add_comment("project", pid, st.session_state.user_email, txt, workspace_id=proj['workspace_id'])
            st.rerun()
import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

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
        t_assignee = st.text_input("Assignee", value=st.session_state.user_email)
        if st.form_submit_button("Add Task"):
            db.create_task(proj['workspace_id'], t_title, "", None, t_assignee, "To Do", "Medium", pid, st.session_state.user_email)
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
import streamlit as st
import time
from bson import ObjectId
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar
from src.chat_ui import render_chat_interface
from src.mailer import notify_admins_extension

st.set_page_config(page_title="Task Details", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

tid = st.session_state.get("selected_task_id")
if not tid: 
    st.warning("No task selected.")
    if st.button("Go to Tasks"): st.switch_page("pages/tasks.py")
    st.stop()

task = db.db.tasks.find_one({"_id": ObjectId(tid)})
if not task: st.error("Task not found."); st.stop()

# --- HEADER ---
col_back, col_title = st.columns([1, 6])
if col_back.button("Back"):
    st.switch_page("pages/tasks.py")
col_title.markdown(f"## {task.get('title')}")

# --- MAIN LAYOUT ---
left, right = st.columns([2, 1])

with left:
    # --- SUBTASKS ---
    st.markdown("### Subtasks")
    subtasks = task.get('subtasks', [])
    
    # Progress Bar
    if subtasks:
        done = sum(1 for s in subtasks if s['completed'])
        pct = done / len(subtasks)
        st.progress(pct, text=f"{int(pct*100)}% Completed")

    # List Subtasks
    for s in subtasks:
        c1, c2 = st.columns([0.05, 0.95])
        checked = c1.checkbox("", value=s['completed'], key=f"sub_{s['id']}")
        if checked != s['completed']:
            db.toggle_subtask(tid, s['id'], checked)
            st.rerun()
        c2.write(s['title'])
        
    # Add Subtask
    with st.form("add_sub"):
        new_sub = st.text_input("Add new subtask...")
        if st.form_submit_button("Add"):
            if new_sub:
                db.add_subtask(tid, new_sub)
                st.rerun()

    # --- COMMENTS ---
    render_chat_interface(tid, "task")

with right:
    st.markdown("### Details")
    
    # STATUS
    statuses = db.get_workspace_statuses(task['workspace_id'])
    curr_status_idx = statuses.index(task['status']) if task['status'] in statuses else 0
    new_status = st.selectbox("Status", statuses, index=curr_status_idx)
    if new_status != task['status']:
        db.update_task_status(tid, new_status)
        st.rerun()

    st.markdown("---")
    
    # TIME TRACKING
    st.markdown("### Time Tracking")
    
    # Start/Stop Logic
    if st.session_state.get('timer_running') and st.session_state.get('timer_task_id') == tid:
        elapsed = int(time.time() - st.session_state.timer_start)
        st.info(f"Tracking: {elapsed}s")
        if st.button("Stop Timer", type="primary", use_container_width=True):
            db.log_time_entry(tid, st.session_state.user_email, elapsed)
            st.session_state.timer_running = False
            st.session_state.timer_start = None
            st.rerun()
    else:
        if st.button("Start Timer", use_container_width=True):
            st.session_state.timer_running = True
            st.session_state.timer_start = time.time()
            st.session_state.timer_task_id = tid
            st.session_state.timer_task_title = task['title']
            st.rerun()

    # Time Logs
    logs = db.get_task_time_entries(tid)
    total_sec = sum(l['seconds'] for l in logs)
    st.caption(f"Total Time: {total_sec//3600}h {(total_sec%3600)//60}m")
    
    with st.expander("View Logs"):
        for l in logs:
            st.write(f"• {l['seconds']//60}m by {l.get('user_email', 'User')}")

    st.markdown("---")
    
    # EXTENSION
    with st.expander("Request Extension"):
        with st.form("ext_req"):
            d = st.date_input("New Date")
            r = st.text_area("Reason")
            if st.form_submit_button("Submit Request"):
                admins = db.request_extension(tid, st.session_state.user_email, d, r)
                notify_admins_extension(admins, task['title'], st.session_state.user_email, r)
                st.success("Request sent to admins.")
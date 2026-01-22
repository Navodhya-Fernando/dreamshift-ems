import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar
from src.mailer import notify_admins_extension

st.set_page_config(page_title="Task Details", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

tid = st.session_state.get("selected_task_id")
if not tid: st.warning("No task."); st.stop()

if st.button("← Back"): st.switch_page("pages/tasks.py")

task = db.db.tasks.find_one({"_id": db.ObjectId(tid)})

st.markdown(f"""<div class="ds-card"><h1>{task['title']}</h1></div>""", unsafe_allow_html=True)

c1, c2 = st.columns([2, 1])

with c1:
    st.subheader("Discussion")
    with st.form("chat"):
        txt = st.text_area("Comment (@mention supported)")
        if st.form_submit_button("Post"):
            db.handle_mentions(txt, st.session_state.user_email, f"task:{tid}")
            st.success("Posted!")

with c2:
    st.subheader("Actions")
    # Status
    statuses = db.get_workspace_statuses(task['workspace_id'])
    curr = statuses.index(task['status']) if task['status'] in statuses else 0
    new_s = st.selectbox("Status", statuses, index=curr)
    if new_s != task['status']:
        db.update_task_status(tid, new_s)
        st.rerun()

    # Request Extension
    with st.expander("Request Extension"):
        with st.form("ext_req"):
            d = st.date_input("New Date")
            r = st.text_area("Reason")
            if st.form_submit_button("Submit Request"):
                admins = db.request_extension(tid, st.session_state.user_email, d, r)
                notify_admins_extension(admins, task['title'], st.session_state.user_email, r)
                st.success("Admins notified via Email & Inbox!")
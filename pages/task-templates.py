import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Task Templates", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

user_email = st.session_state.get("user_email")
if not user_email:
	st.warning("Please sign in to continue.")
	st.switch_page("pages/sign-in.py")

icon = get_svg("templates.svg", 36, 36) or ":material/extension:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Templates</h1></div>""", unsafe_allow_html=True)
st.write("Manage Task Templates")

# Workspace selector
workspaces = db.get_user_workspaces(user_email)
ws_options = {w["name"]: str(w["_id"]) for w in workspaces}
current_ws_id = st.session_state.get("current_ws_id")
default_ws_index = 0
if current_ws_id and current_ws_id in ws_options.values():
	default_ws_index = list(ws_options.values()).index(current_ws_id)

if not ws_options:
	st.info("No workspaces found.")
	st.stop()

workspace_name = st.selectbox("Workspace", list(ws_options.keys()), index=default_ws_index)
workspace_id = ws_options[workspace_name]

st.markdown("---")

# Existing templates
st.markdown("### Existing Templates")
templates = db.get_task_templates(workspace_id)
if not templates:
	st.caption("No templates yet for this workspace.")
else:
	for t in templates:
		with st.expander(t.get("name", "Template")):
			tasks = t.get("tasks", [])
			if tasks:
				for item in tasks:
					title = item.get("title") or "Untitled"
					priority = item.get("priority", "Medium")
					offset = item.get("offset_days", "—")
					assignee = item.get("assignee") or "—"
					status = item.get("status", "To Do")
					st.write(f"• {title} | Priority: {priority} | Offset: {offset} days | Status: {status} | Assignee: {assignee}")
			else:
				st.caption("No tasks in this template.")

			if st.button("Delete Template", key=f"del_{t['_id']}", type="secondary"):
				db.delete_task_template(str(t["_id"]))
				st.rerun()

st.markdown("---")

# Create template
st.markdown("### Create New Template")
st.caption("Add tasks with optional due date offsets (days from project start). Assignee should be an email.")

default_rows = [
	{"title": "", "priority": "Medium", "offset_days": 0, "assignee": "", "status": "To Do", "description": ""}
	for _ in range(3)
]

with st.form("create_template"):
	template_name = st.text_input("Template Name", placeholder="e.g. Operations Onboarding")
	tasks_data = st.data_editor(
		default_rows,
		key="template_tasks_editor",
		use_container_width=True,
		num_rows="dynamic",
		column_config={
			"title": st.column_config.TextColumn("Task Title"),
			"priority": st.column_config.SelectboxColumn("Priority", options=["Low", "Medium", "High", "Critical"]),
			"offset_days": st.column_config.NumberColumn("Offset Days", min_value=0, step=1),
			"assignee": st.column_config.TextColumn("Assignee (email)"),
			"status": st.column_config.SelectboxColumn("Status", options=["To Do", "In Progress", "Review", "Completed"]),
			"description": st.column_config.TextColumn("Description")
		}
	)

	if st.form_submit_button("Save Template", type="primary", use_container_width=True):
		if not template_name.strip():
			st.error("Template name is required.")
		else:
			cleaned_tasks = []
			for row in tasks_data:
				title = (row.get("title") or "").strip()
				if not title:
					continue
				cleaned_tasks.append({
					"title": title,
					"priority": row.get("priority") or "Medium",
					"offset_days": row.get("offset_days", 0),
					"assignee": (row.get("assignee") or "").strip() or None,
					"status": row.get("status") or "To Do",
					"description": (row.get("description") or "").strip()
				})

			db.create_task_template(workspace_id, template_name.strip(), cleaned_tasks, user_email)
			st.success("Template created.")
			st.rerun()
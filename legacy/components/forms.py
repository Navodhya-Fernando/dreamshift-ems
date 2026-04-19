import streamlit as st
from datetime import date

def project_create_form(workspaces, task_templates=None):
    """ClickUp-style project creation form"""
    with st.form("create_project_form", border=False):
        st.markdown("### Create Project")

        col1, col2 = st.columns([2, 1])
        with col1:
            name = st.text_input("Project Name", placeholder="e.g., Client Onboarding Pipeline")
        with col2:
            due = st.date_input("Due Date", value=None)

        desc = st.text_area("Description (Optional)", placeholder="Short summary of scope…", height=100)

        # Workspace selector
        if workspaces:
            ws_options = [(str(w["_id"]), w["name"]) for w in workspaces]
            ws_name_list = [n for _, n in ws_options]
            ws_selected_name = st.selectbox("Workspace", ws_name_list)
            workspace_id = [wid for wid, n in ws_options if n == ws_selected_name][0]
        else:
            st.error("No workspaces available")
            workspace_id = None

        # Task template selector
        if task_templates:
            template_options = ["None"] + [t.get("name", "Template") for t in task_templates]
            template_name = st.selectbox("Task Template", template_options)
        else:
            template_name = "None"

        submitted = st.form_submit_button("Create Project", use_container_width=True, type="primary")
        
        if not submitted:
            return None

        if not name.strip():
            st.error("Project Name is required.")
            return None

        if not workspace_id:
            st.error("Workspace is required.")
            return None

        return {
            "name": name.strip(),
            "description": desc.strip() if desc else "",
            "due_date": str(due) if due else None,
            "workspace_id": workspace_id,
            "task_template": None if template_name == "None" else template_name,
        }

def task_create_form(users, workspace_id=None):
    """ClickUp-style task creation form"""
    with st.form("create_task_form", border=False):
        st.markdown("### Create Task")

        col1, col2 = st.columns([2, 1])
        with col1:
            name = st.text_input("Task Name", placeholder="e.g., Draft proposal document")
        with col2:
            due = st.date_input("Due Date", value=None)

        # Assignee selector (by name)
        if users:
            user_options = [(str(u.get("_id") or u.get("email")), u.get("name") or u.get("email")) for u in users]
            user_labels = [label for _, label in user_options]
            assignee_label = st.selectbox("Assignee", ["Unassigned"] + user_labels)
        else:
            assignee_label = "Unassigned"

        priority = st.selectbox("Priority", ["Low", "Medium", "High", "Urgent"])

        submitted = st.form_submit_button("Create Task", use_container_width=True, type="primary")
        
        if not submitted:
            return None

        if not name.strip():
            st.error("Task Name is required.")
            return None

        assignee_id = None
        if assignee_label != "Unassigned" and users:
            assignee_id = [uid for uid, label in user_options if label == assignee_label][0]

        return {
            "name": name.strip(),
            "assignee_id": assignee_id,
            "due_date": str(due) if due else None,
            "priority": priority,
            "workspace_id": workspace_id,
        }

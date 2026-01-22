import streamlit as st
import datetime
import html
from bson import ObjectId
from src.database import DreamShiftDB

# Page config
st.set_page_config(page_title="Task Templates | DreamShift EMS", page_icon="🎯", layout="wide", initial_sidebar_state="expanded")

# Load base CSS and setup
from src.ui import load_global_css, render_custom_sidebar

# Render custom sidebar
render_custom_sidebar()

# Load global CSS
load_global_css()

# Helpers
def render_html(html_str: str):
    """Strip leading whitespace so Streamlit does not treat it as code."""
    cleaned = "\n".join([line.lstrip() for line in html_str.split("\n")])
    st.markdown(cleaned, unsafe_allow_html=True)

# App
# ------------------------------------------------------------
db = DreamShiftDB()

# Auth check
if "user_email" not in st.session_state:
    st.error("Please login on the Home page first.")
    st.stop()

if "current_ws_id" not in st.session_state:
    st.warning("Please select a workspace first.")
    st.stop()

ws_id = st.session_state.current_ws_id
user_role = st.session_state.get("user_role", "Employee")
user_email = st.session_state.user_email

# ------------------------------------------------------------
# Header
# ------------------------------------------------------------
render_html("""
<div class="ds-page-head">
  <div>
    <h1 class="ds-page-title">Task Templates</h1>
    <p class="ds-page-sub">Create reusable task sets for projects (CV writing, LinkedIn, packages)</p>
  </div>
</div>
""")

# Only admins can manage templates
if user_role not in ["Owner", "Workspace Admin"]:
    st.info("Only Owners or Workspace Admins can manage templates.")
    st.stop()

# ------------------------------------------------------------
# Template List & Create
# ------------------------------------------------------------
templates = db.get_task_templates(ws_id)

render_html('<div class="ds-card">')
render_html('<div class="ds-card-title">Templates</div>')
render_html('<div class="ds-card-sub">Select one to edit</div>')

if not templates:
    st.caption("No templates yet. Create your first one.")
    render_html('<div class="ds-empty-state">')
    st.write("No templates found. Use the form on the left to create a new template.")
    render_html("</div>")
else:
    tpl_names = [t.get("name", "Untitled") for t in templates]
    tpl_ids = [str(t["_id"]) for t in templates]
    pick = st.selectbox("Choose template", tpl_names, index=0)
    selected_tpl_id = tpl_ids[tpl_names.index(pick)]

render_html("</div>")

st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

render_html('<div class="ds-card">')
render_html('<div class="ds-card-title">Create Template</div>')
with st.form("create_template_form"):
    name = st.text_input("Template name", placeholder="e.g., CV Writing - Standard")
    desc = st.text_area("Description (optional)", placeholder="What this template is for...")
    submitted = st.form_submit_button("Create", use_container_width=True)
    if submitted:
        if not name.strip():
            st.error("Template name is required.")
        else:
            db.create_task_template(
                workspace_id=ws_id,
                name=name.strip(),
                description=desc.strip(),
                items=[],
                created_by=user_email,
            )
            st.success("Template created.")
            st.rerun()
render_html("</div>")

# ------------------------------------------------------------
# Template Editor
# ------------------------------------------------------------
if not selected_tpl_id:
    st.stop()

tpl = db.get_task_template_by_id(ws_id, selected_tpl_id)
if not tpl:
    st.error("Template not found.")
    st.stop()

tpl_name = tpl.get("name", "Untitled")
tpl_desc = tpl.get("description", "")

render_html(f"""
<div class="ds-card">
  <div class="ds-card-title">Edit</div>
  <div class="ds-card-sub">{html.escape(tpl_name)}</div>
</div>
""")

# Update template info
with st.form("update_template_info"):
    new_name = st.text_input("Name", value=tpl_name)
    new_desc = st.text_area("Description", value=tpl_desc)
    c1, c2 = st.columns([1, 1])
    save = c1.form_submit_button("Save", use_container_width=True)
    deactivate = c2.form_submit_button("Deactivate", use_container_width=True)
    
    if save:
        db.update_task_template(ws_id, selected_tpl_id, {"name": new_name.strip(), "description": new_desc.strip()})
        st.success("Saved.")
        st.rerun()
    
    if deactivate:
        db.update_task_template(ws_id, selected_tpl_id, {"is_active": False})
        st.success("Deactivated.")
        st.rerun()

# Items editor
items = tpl.get("items", [])
items = sorted(items, key=lambda x: x.get("order", 0))

render_html('<div class="ds-card">')
render_html('<div class="ds-card-title">Tasks in this template</div>')
render_html('<div class="ds-card-sub">These will be created automatically when you choose this template</div>')

if not items:
    st.caption("No tasks yet. Add tasks below.")
    render_html('<div class="ds-empty-state">')
    st.write("This template has no tasks yet. Use the form below to add tasks.")
    render_html("</div>")
else:
    for i, it in enumerate(items, start=1):
        title = it.get("title", "")
        priority = it.get("priority", "Medium")
        offset = it.get("default_days_offset", 0)
        role = it.get("default_assignee_role", "")
        
        with st.expander(f"{i}. {title}", expanded=False):
            with st.form(f"edit_item_{i}"):
                t = st.text_input("Title", value=title)
                d = st.text_area("Description", value=it.get("description", ""))
                c1, c2, c3 = st.columns(3)
                with c1:
                    p = st.selectbox("Priority", ["Low", "Medium", "High"], index=["Low", "Medium", "High"].index(priority))
                with c2:
                    off = st.number_input("Default days offset", value=int(offset), min_value=0, step=1)
                with c3:
                    r = st.selectbox("Default assignee role (optional)", ["", "Employee", "Workspace Admin", "Owner"], index=["", "Employee", "Workspace Admin", "Owner"].index(role) if role in ["", "Employee", "Workspace Admin", "Owner"] else 0)
                
                col_btn, col_spacer = st.columns([1, 8])
                with col_btn:
                    save_item = st.form_submit_button("Update task", use_container_width=True)
                with col_spacer:
                    remove_item = st.form_submit_button("Remove task", use_container_width=True)
                
                if save_item:
                    db.update_task_template_item(ws_id, selected_tpl_id, order=i, updates={
                        "title": t.strip(),
                        "description": d.strip(),
                        "priority": p,
                        "default_days_offset": int(off),
                        "default_assignee_role": r,
                    })
                    st.success("Updated.")
                    st.rerun()
                
                if remove_item:
                    db.remove_task_template_item(ws_id, selected_tpl_id, order=i)
                    st.success("Removed.")
                    st.rerun()

render_html("</div>")

# Add new item
render_html('<div class="ds-card">')
render_html('<div class="ds-card-title">Add task</div>')
with st.form("add_item"):
    t = st.text_input("Title", placeholder="e.g., ATS research + role targeting")
    d = st.text_area("Description (optional)", placeholder="Short instruction for the team member...")
    c1, c2, c3 = st.columns(3)
    with c1:
        p = st.selectbox("Priority", ["Low", "Medium", "High"], index=1)
    with c2:
        off = st.number_input("Default days offset", value=0, min_value=0, step=1)
    with c3:
        r = st.selectbox("Default assignee role (optional)", ["", "Employee", "Workspace Admin", "Owner"], index=0)
    
    add = st.form_submit_button("Add", use_container_width=True)
    if add:
        if not t.strip():
            st.error("Title is required.")
        else:
            db.add_task_template_item(ws_id, selected_tpl_id, {
                "title": t.strip(),
                "description": d.strip(),
                "priority": p,
                "default_days_offset": int(off),
                "default_assignee_role": r,
            })
            st.success("Added.")
            st.rerun()
render_html("</div>")

# ------------------------------------------------------------
# Footer
# ------------------------------------------------------------
st.markdown("---")
render_html("""
<div class="ds-footer">
  DreamShift EMS © 2026
</div>
""")

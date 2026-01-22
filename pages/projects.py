import streamlit as st
import datetime
from bson import ObjectId

from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Projects", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

db = DreamShiftDB()

# Auth guard
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

# Header (SVG only, no emoji fallback)
icon = get_svg("projects.svg", 28, 28)
st.markdown(
    f"""
    <div class="ds-page-head">
        <div class="ds-page-head-left">
            <div class="ds-page-icon">{icon}</div>
            <div class="ds-page-titles">
                <div class="ds-page-title">Projects</div>
                <div class="ds-page-subtitle">Create projects, track progress, and keep work organized.</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# -----------------------------
# Workspace options (selector stays in sidebar, but form needs choices)
# -----------------------------
user_workspaces = db.get_user_workspaces(st.session_state.user_email) or []
ws_options = {w.get("name", "Workspace"): str(w["_id"]) for w in user_workspaces}
current_ws_id = st.session_state.get("current_ws_id")

if not ws_options:
    st.markdown(
        """
        <div class="ds-empty-state">
          <div class="ds-empty-title">No workspaces found</div>
          <div class="ds-empty-sub">Create a workspace first to start adding projects.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.stop()

# Default to current workspace if set
ws_ids = list(ws_options.values())
default_ws_index = ws_ids.index(current_ws_id) if current_ws_id in ws_ids else 0

# -----------------------------
# Create Project (requirements you gave)
# Project Name, Desc (Optional), Due Date, Workspace, Task Template (None option)
# -----------------------------
with st.expander("Create Project", expanded=False):
    st.markdown(
        "<div class='ds-form-head'>New project</div><div class='ds-form-sub'>Set the basics. You can refine later.</div>",
        unsafe_allow_html=True,
    )

    # Try to load templates if your DB supports it; fallback to None only.
    template_options = ["None"]
    try:
        # If you implement templates as a collection:
        # templates = list(db.db.task_templates.find({"workspace_id": current_ws_id}).sort("name", 1))
        # template_options = ["None"] + [t["name"] for t in templates if t.get("name")]
        templates = list(db.db.task_templates.find({}).sort("name", 1))
        template_options = ["None"] + [t["name"] for t in templates if t.get("name")]
        # keep unique + stable
        template_options = list(dict.fromkeys(template_options))
    except Exception:
        template_options = ["None"]

    with st.form("new_proj_form", clear_on_submit=True):
        r1c1, r1c2 = st.columns([2.2, 1.4])
        with r1c1:
            name = st.text_input("Project Name", placeholder="e.g., DreamShift EMS UI Revamp")
        with r1c2:
            workspace_name = st.selectbox("Workspace", list(ws_options.keys()), index=default_ws_index)

        r2c1, r2c2 = st.columns([1.4, 1.2])
        with r2c1:
            due_date = st.date_input(
                "Due Date",
                value=datetime.date.today() + datetime.timedelta(days=30),
            )
        with r2c2:
            task_template = st.selectbox("Task Template", template_options, index=0)

        desc = st.text_area(
            "Description (Optional)",
            placeholder="What is this project about?",
            height=110,
        )

        a1, a2 = st.columns([1.2, 4.8])
        create = a1.form_submit_button("Create", type="primary", use_container_width=True)
        cancel = a2.form_submit_button("Cancel", type="secondary", use_container_width=True)

        if cancel:
            st.stop()

        if create:
            if not (name or "").strip():
                st.error("Project Name is required.")
            else:
                selected_ws_id = ws_options[workspace_name]

                proj_data = {
                    "workspace_id": selected_ws_id,
                    "name": name.strip(),
                    "description": (desc or "").strip(),
                    "deadline": datetime.datetime.combine(due_date, datetime.time()),
                    "template": None if task_template == "None" else task_template,
                    "created_by": st.session_state.user_email,
                    "created_at": datetime.datetime.utcnow(),
                    "status": "Active",
                }

                db.db.projects.insert_one(proj_data)

                # Switch context to selected workspace (nice UX)
                st.session_state.current_ws_id = selected_ws_id
                st.success("Project created.")
                st.rerun()

# -----------------------------
# Projects Grid (current workspace)
# -----------------------------
if not current_ws_id:
    st.markdown(
        "<div class='ds-empty-mini'>Select a workspace from the sidebar to view projects.</div>",
        unsafe_allow_html=True,
    )
    st.stop()

projects = list(db.db.projects.find({"workspace_id": current_ws_id}).sort("created_at", -1))

st.markdown("<div class='ds-section-title'>Projects</div>", unsafe_allow_html=True)
st.markdown("<div class='ds-section-sub'>Projects in the selected workspace.</div>", unsafe_allow_html=True)

if not projects:
    st.markdown("<div class='ds-empty-mini'>No projects found in this workspace.</div>", unsafe_allow_html=True)
    st.stop()

cols = st.columns(3)
for idx, p in enumerate(projects):
    with cols[idx % 3]:
        pid = str(p["_id"])
        pname = p.get("name", "Untitled Project")
        pdesc = (p.get("description") or "").strip()
        pdesc_short = (pdesc[:90] + "…") if len(pdesc) > 90 else (pdesc or "No description yet.")

        # Progress
        p_tasks = list(db.db.tasks.find({"project_id": pid}))
        total = len(p_tasks)
        done = sum(1 for t in p_tasks if t.get("status") == "Completed")
        progress = (done / total) if total > 0 else 0
        pct = int(progress * 100)

        # Due date
        deadline = p.get("deadline")
        if isinstance(deadline, datetime.datetime):
            due_str = deadline.strftime("%b %d")
        else:
            due_str = "Not set"

        st.markdown(
            f"""
            <div class="ds-proj-card">
              <div class="ds-proj-top">
                <div class="ds-proj-title">{pname}</div>
                <div class="ds-proj-meta">Due: {due_str}</div>
              </div>

              <div class="ds-proj-desc">{pdesc_short}</div>

              <div class="ds-proj-stats">
                <div class="ds-proj-stat"><span class="ds-strong">{pct}%</span> complete</div>
                <div class="ds-proj-stat"><span class="ds-strong">{total}</span> tasks</div>
              </div>

              <div class="ds-proj-bar">
                <div class="ds-proj-bar-fill" style="width:{pct}%;"></div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        if st.button("Open", key=f"open_proj_{pid}", use_container_width=True, type="secondary"):
            st.session_state.selected_project_id = pid
            st.switch_page("pages/project-details.py")

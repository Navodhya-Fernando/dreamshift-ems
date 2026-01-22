import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Workspaces", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

db = DreamShiftDB()

# Auth guard (keeps behavior consistent across pages)
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

ws_id = st.session_state.get("current_ws_id")

# Header (no emoji, SVG only)
icon = get_svg("workspaces.svg", 28, 28)
st.markdown(
    f"""
    <div class="ds-page-head">
        <div class="ds-page-head-left">
            <div class="ds-page-icon">{icon}</div>
            <div class="ds-page-titles">
                <div class="ds-page-title">Workspaces</div>
                <div class="ds-page-subtitle">Manage your team and workflow settings.</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# -----------------------------
# Workspace selection fallback
# -----------------------------
if not ws_id:
    workspaces = db.get_user_workspaces(st.session_state.user_email)

    if not workspaces:
        st.markdown(
            """
            <div class="ds-empty-state">
              <div class="ds-empty-title">No workspaces yet</div>
              <div class="ds-empty-sub">Create your first workspace to start organizing projects and tasks.</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        with st.form("create_ws_first", clear_on_submit=True):
            name = st.text_input("Workspace Name", placeholder="e.g., DreamShift Ops")
            c1, c2 = st.columns([1, 3])
            create = c1.form_submit_button("Create", type="primary", use_container_width=True)
            cancel = c2.form_submit_button("Cancel", type="secondary", use_container_width=True)

            if cancel:
                st.stop()

            if create:
                if not name.strip():
                    st.error("Workspace name is required.")
                else:
                    new_id = db.create_workspace(name.strip(), st.session_state.user_email)
                    st.session_state.current_ws_id = str(new_id)
                    st.rerun()
        st.stop()

    st.markdown(
        """
        <div class="ds-empty-mini">
          Select a workspace from the sidebar workspace switcher to continue.
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.stop()

# -----------------------------
# Tabs
# -----------------------------
tab1, tab2 = st.tabs(["Team Members", "Workflow Settings"])

# -----------------------------
# Quick Create Workspace (compact)
# -----------------------------
with st.expander("Create a new workspace"):
    with st.form("create_ws_inline", clear_on_submit=True):
        name = st.text_input("Workspace Name", placeholder="e.g., Client Delivery")
        c1, c2 = st.columns([1, 3])
        create = c1.form_submit_button("Create", type="primary", use_container_width=True)
        cancel = c2.form_submit_button("Cancel", type="secondary", use_container_width=True)

        if cancel:
            st.stop()

        if create:
            if not name.strip():
                st.error("Workspace name is required.")
            else:
                new_id = db.create_workspace(name.strip(), st.session_state.user_email)
                st.session_state.current_ws_id = str(new_id)
                st.success("Workspace created.")
                st.rerun()

# -----------------------------
# TEAM MEMBERS
# -----------------------------
with tab1:
    st.markdown(
        """
        <div class="ds-section-title">Team Members</div>
        <div class="ds-section-sub">Invite members, assign roles, and keep your workspace organized.</div>
        """,
        unsafe_allow_html=True,
    )

    members = db.get_workspace_members(ws_id) or []

    # Add Member Card
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Add member</div>", unsafe_allow_html=True)

    with st.form("add_member", clear_on_submit=True):
        c1, c2, c3 = st.columns([3, 1.4, 1.2])
        new_email = c1.text_input("Email Address", placeholder="name@company.com")
        role = c2.selectbox("Role", ["Admin", "Employee", "Viewer"])
        add = c3.form_submit_button("Invite", use_container_width=True, type="primary")

        if add:
            if not new_email.strip():
                st.error("Email address is required.")
            else:
                success, msg = db.add_workspace_member(ws_id, new_email.strip(), role)
                if success:
                    st.success("Member added.")
                else:
                    st.error(msg)
                st.rerun()

    st.markdown("</div>", unsafe_allow_html=True)

    # Members list
    st.markdown("<div style='height:10px'></div>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Current team</div>", unsafe_allow_html=True)

    if not members:
        st.markdown("<div class='ds-empty-mini'>No members found.</div>", unsafe_allow_html=True)
    else:
        for m in members:
            name = m.get("name") or m.get("email", "Unknown")
            email = m.get("email", "")
            role = m.get("role", "Employee")

            row1, row2, row3 = st.columns([3.2, 1.2, 1.2])
            with row1:
                st.markdown(
                    f"""
                    <div class="ds-member">
                      <div class="ds-member-name">{name}</div>
                      <div class="ds-member-email">{email}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
            with row2:
                st.markdown(f"<div class='ds-pill'>{role}</div>", unsafe_allow_html=True)
            with row3:
                if st.button("Remove", key=f"rm_{email}", use_container_width=True, type="secondary"):
                    db.remove_workspace_member(ws_id, email)
                    st.rerun()

    st.markdown("</div>", unsafe_allow_html=True)

# -----------------------------
# WORKFLOW SETTINGS
# -----------------------------
with tab2:
    st.markdown(
        """
        <div class="ds-section-title">Workflow Settings</div>
        <div class="ds-section-sub">Customize your task columns to match how your team works.</div>
        """,
        unsafe_allow_html=True,
    )

    current = db.get_workspace_statuses(ws_id) or []

    st.markdown("<div class='ds-card'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-card-title'>Task statuses</div>", unsafe_allow_html=True)

    with st.form("status_edit"):
        st.markdown("<div class='ds-form-hint'>Enter statuses as a comma-separated list.</div>", unsafe_allow_html=True)
        new = st.text_input("Statuses", value=",".join(current), placeholder="To Do, In Progress, Review, Done")
        c1, c2 = st.columns([1.2, 3])
        update = c1.form_submit_button("Update", type="primary", use_container_width=True)
        cancel = c2.form_submit_button("Cancel", type="secondary", use_container_width=True)

        if cancel:
            st.stop()

        if update:
            statuses = [s.strip() for s in (new or "").split(",") if s.strip()]
            if not statuses:
                st.error("Please provide at least one status.")
            else:
                db.update_workspace_statuses(ws_id, statuses)
                st.success("Workflow updated.")
                st.rerun()

    st.markdown("</div>", unsafe_allow_html=True)

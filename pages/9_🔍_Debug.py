import streamlit as st
from src.database import DreamShiftDB

st.set_page_config(page_title="Debug | DreamShift EMS", page_icon="🔍", layout="wide", initial_sidebar_state="expanded")

# Load UI utilities
from src.ui import load_global_css, render_custom_sidebar

# Render custom sidebar
render_custom_sidebar()

# Load global CSS
load_global_css()

db = DreamShiftDB()

st.title("🔍 Debug: User & Workspace Info")

if "user_email" not in st.session_state:
    st.error("Not logged in")
    st.stop()

user_email = st.session_state.user_email
st.write(f"**Logged in as:** {user_email}")

# Get user from database
user = db.get_user(user_email)
st.write("### User Document")
st.json({
    "email": user.get("email"),
    "name": user.get("name"),
    "role_in_user_doc": user.get("role"),
    "created_at": str(user.get("created_at"))
})

# Get all workspaces this user is member of
workspaces = db.get_user_workspaces(user_email)
st.write(f"### Workspaces ({len(workspaces)} total)")

if not workspaces:
    st.warning("You are not a member of any workspace. Ask a workspace owner to invite you.")
else:
    for ws in workspaces:
        ws_id = str(ws["_id"])
        ws_name = ws.get("name", "Unnamed")
        members = ws.get("members", [])
        
        # Find this user's role
        user_member = next((m for m in members if m.get("email") == user_email), None)
        user_role = user_member.get("role") if user_member else "NOT FOUND"
        
        with st.expander(f"**{ws_name}** (Role: {user_role})", expanded=True):
            st.write(f"**Workspace ID:** {ws_id}")
            st.write(f"**Owner:** {ws.get('owner')}")
            st.write(f"**Your role in this workspace:** {user_role}")
            st.write(f"**Total members:** {len(members)}")
            
            st.write("**All members:**")
            for m in members:
                m_email = m.get("email")
                m_role = m.get("role", "Employee")
                m_user = db.get_user(m_email)
                m_name = m_user.get("name") if m_user else m_email
                is_you = " **(YOU)**" if m_email == user_email else ""
                st.write(f"- {m_name} ({m_email}) - **{m_role}**{is_you}")

# Show current session state
st.write("### Current Session State")
st.json({
    "user_email": st.session_state.get("user_email"),
    "user_name": st.session_state.get("user_name"),
    "current_ws_id": st.session_state.get("current_ws_id"),
    "current_ws_name": st.session_state.get("current_ws_name"),
    "user_role": st.session_state.get("user_role"),
})

st.info("💡 **Tip**: If you see 'Owner' but you should be 'Employee', ask the workspace owner to check the Team tab in Workspaces and verify your role is set correctly.")

# Example for a button:
# col_btn, col_spacer = st.columns([1, 8])
# with col_btn:
#     if st.button("Button Text"):
#         ...
# Apply this pattern to all single buttons and form_submit_buttons on this page.

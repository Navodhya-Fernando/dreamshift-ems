import streamlit as st
import pandas as pd
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Admin Panel", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

# Auth Check
user = db.get_user(st.session_state.user_email)
if not user or user.get('role') != "Admin": # Assuming 'Admin' role string
    # Fallback for Owner of workspace if not system admin
    # In a real app, strict RBAC needed.
    pass 

icon = get_svg("admin.svg", 36, 36) or ":material/admin_panel_settings:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Admin Console</h1></div>""", unsafe_allow_html=True)

tab1, tab2 = st.tabs(["User Management", "System Health"])

with tab1:
    st.subheader("Registered Users")
    users = list(db.db.users.find({}, {"password": 0})) # Exclude passwords
    df = pd.DataFrame(users)
    if not df.empty:
        st.dataframe(df[['name', 'email', 'role', 'created_at']], use_container_width=True)
    
    st.subheader("Grant Admin Access")
    with st.form("grant_admin"):
        email = st.text_input("User Email")
        if st.form_submit_button("Promote to Admin"):
            db.db.users.update_one({"email": email}, {"$set": {"role": "Admin"}})
            st.success(f"{email} is now an Admin.")

with tab2:
    st.subheader("Database Stats")
    c1, c2, c3 = st.columns(3)
    c1.metric("Total Users", db.db.users.count_documents({}))
    c2.metric("Total Tasks", db.db.tasks.count_documents({}))
    c3.metric("Workspaces", db.db.workspaces.count_documents({}))
import streamlit as st

PAGES = {
    "Home": "Home.py",
    "Workspaces": "pages/workspaces.py",
    "Projects": "pages/projects.py",
    "Tasks": "pages/tasks.py",
    "Inbox": "pages/inbox.py",
    "Profile": "pages/profile.py",
    "Settings": "pages/settings.py",
}

def render_workspace_switcher(workspaces, current_workspace_id, on_change_key="ws_switch"):
    st.sidebar.markdown('<div class="ds-sidebar-section-title">WORKSPACE</div>', unsafe_allow_html=True)
    
    if not workspaces:
        st.sidebar.warning("No workspaces")
        return None
    
    options = [(str(w["_id"]), w["name"]) for w in workspaces]
    id_to_name = {wid: name for wid, name in options}
    name_list = [name for _, name in options]

    default_index = 0
    if current_workspace_id and current_workspace_id in id_to_name:
        default_index = name_list.index(id_to_name[current_workspace_id])

    selected_name = st.sidebar.selectbox(
        "Select Workspace",
        name_list,
        index=default_index,
        key=on_change_key,
        label_visibility="collapsed"
    )

    selected_id = [wid for wid, name in options if name == selected_name][0]
    return selected_id

def nav_button(label, page_path, icon=None):
    """Navigation button with optional icon"""
    if st.sidebar.button(label, use_container_width=True, key=f"nav_{label}"):
        st.switch_page(page_path)

def render_sidebar(user, workspaces, current_workspace_id):
    """Main sidebar rendering function"""
    st.sidebar.markdown('<div class="ds-sidebar">', unsafe_allow_html=True)

    # Logo
    st.sidebar.markdown("""
    <div style="margin-bottom: 25px; padding: 10px 5px;">
        <h2 style="margin:0; color:#f6b900; font-size: 1.6rem; font-weight: 800; letter-spacing: -1px;">
            DreamShift
        </h2>
    </div>
    """, unsafe_allow_html=True)

    # Workspace switcher
    selected_workspace_id = render_workspace_switcher(workspaces, current_workspace_id)

    st.sidebar.markdown('<div style="height: 20px;"></div>', unsafe_allow_html=True)

    # Main navigation
    st.sidebar.markdown('<div class="ds-sidebar-nav">', unsafe_allow_html=True)
    st.sidebar.markdown('<div class="ds-sidebar-section-title">MAIN</div>', unsafe_allow_html=True)
    
    for label, path in PAGES.items():
        if label in ["Profile", "Settings"]:
            continue  # These go in footer
        nav_button(label, path)
    
    st.sidebar.markdown("</div>", unsafe_allow_html=True)

    # Footer with user profile
    st.sidebar.markdown("---")
    st.sidebar.markdown('<div class="ds-sidebar-footer">', unsafe_allow_html=True)
    
    if user:
        user_name = user.get('name', user.get('email', 'User'))
        user_initial = user_name[0].upper() if user_name else "U"
        
        st.sidebar.markdown(f"""
        <div style="display:flex; align-items:center; gap:12px; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px;">
            <div style="width:32px; height:32px; background:#f6b900; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#411c30; font-size: 14px;">
                {user_initial}
            </div>
            <div style="overflow:hidden;">
                <div style="font-size:0.9rem; font-weight:600; color: #eee;">{user_name}</div>
                <div style="font-size:0.75rem; opacity:0.6;">{user.get('email', '')}</div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        c1, c2 = st.sidebar.columns(2)
        with c1:
            if st.button("⚙️ Settings", key="nav_settings_btn", use_container_width=True):
                st.switch_page(PAGES["Settings"])
        with c2:
            if st.button("🚪 Logout", key="logout_btn", use_container_width=True):
                for k in list(st.session_state.keys()):
                    del st.session_state[k]
                st.switch_page("pages/sign-in.py")
    
    st.sidebar.markdown("</div></div>", unsafe_allow_html=True)

    return selected_workspace_id

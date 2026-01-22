import streamlit as st
import time
from pathlib import Path
from src.database import DreamShiftDB


# -----------------------------
# GLOBAL CSS
# -----------------------------
def load_global_css():
    try:
        with open("static/styles.css", "r", encoding="utf-8") as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)
    except FileNotFoundError:
        pass


# -----------------------------
# SVG HELPERS
# -----------------------------
def get_svg(filename: str, width: int = 18, height: int = 18) -> str:
    """
    Returns SVG markup wrapped in a div, so it can be aligned consistently.
    Expects files in: static/icons/<filename>
    """
    path = Path(f"static/icons/{filename}")
    if not path.exists():
        return ""

    content = path.read_text(encoding="utf-8")

    return (
        f'<div class="ds-icon" style="width:{width}px;height:{height}px">'
        f"{content}"
        f"</div>"
    )


# -----------------------------
# STREAMLIT DEFAULT NAV HIDE
# -----------------------------
def hide_streamlit_sidebar():
    """Hide default Streamlit sidebar nav."""
    st.markdown(
        """
        <style>
          section[data-testid="stSidebarNav"] { display: none !important; }
          [data-testid="stSidebarNav"] { display: none !important; }
        </style>
        """,
        unsafe_allow_html=True,
    )


# -----------------------------
# TIMER (CLOCKIFY STYLE)
# -----------------------------
def render_sidebar_timer():
    """
    Sidebar timer card.
    Expects:
      st.session_state.timer_running: bool
      st.session_state.timer_start: epoch seconds
      st.session_state.timer_task_title: str
    """
    if "timer_running" not in st.session_state:
        st.session_state.timer_running = False

    if st.session_state.timer_running and "timer_start" in st.session_state:
        elapsed = int(time.time() - st.session_state.timer_start)
        h, r = divmod(elapsed, 3600)
        m, s = divmod(r, 60)
        time_str = f"{h:02}:{m:02}:{s:02}"

        st.sidebar.markdown(
            f"""
            <div class="ds-timer-card">
                <div class="ds-timer-label">Tracking time</div>
                <div class="ds-timer-display">{time_str}</div>
                <div class="ds-timer-task">{st.session_state.get('timer_task_title', 'Unknown Task')}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        if st.sidebar.button("Stop Timer", use_container_width=True, key="timer_stop_btn"):
            st.session_state.stop_timer_trigger = True
            st.rerun()


# -----------------------------
# NAV ITEM RENDERER (SVG + LABEL)
# -----------------------------
def _nav_item(label: str, page_path: str, svg_file: str):
    """
    Renders a custom nav row with SVG icon and label, using st.button for click.
    We render an HTML row for visuals, and a button for interaction.
    """
    # active page state (manual, stable across reruns)
    active_label = st.session_state.get("active_nav", "Home")
    is_active = (active_label == label)

    # Visual row
    st.markdown(
        f"""
        <div class="ds-nav-row {'is-active' if is_active else ''}">
            <div class="ds-nav-icon">{get_svg(svg_file)}</div>
            <div class="ds-nav-label">{label}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Click layer
    # Styled via CSS to overlay or appear as minimal clickable row
    if st.button(label, key=f"ds_nav_btn_{label}", use_container_width=True):
        st.session_state.active_nav = label
        st.switch_page(page_path)


# -----------------------------
# SIDEBAR
# -----------------------------
def render_custom_sidebar():
    """
    Sidebar requirements:
      Home, Workspaces, Projects, Tasks, Inbox, Profile, Settings, Log Out, Workspace Switcher (and nothing else)
      No emoji icons; use SVGs.
    """
    db = DreamShiftDB()

    with st.sidebar:
        # Brand / Logo
        st.markdown(
            """
            <div class="ds-brand">
                <div class="ds-brand-title">DreamShift</div>
                <div class="ds-brand-subtitle">EMS</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        # Timer card (Clockify vibe)
        render_sidebar_timer()

        # Workspace Switcher (must be in sidebar)
        if "user_email" in st.session_state:
            workspaces = db.get_user_workspaces(st.session_state.user_email) or []
            ws_names = [w.get("name", "Untitled") for w in workspaces]
            current_id = st.session_state.get("current_ws_id")

            curr_idx = 0
            if current_id:
                for idx, w in enumerate(workspaces):
                    if str(w.get("_id")) == str(current_id):
                        curr_idx = idx
                        break

            if ws_names:
                st.markdown('<div class="ds-sidebar-section-title">Workspace</div>', unsafe_allow_html=True)

                selected_ws = st.selectbox(
                    "Workspace Switcher",
                    ws_names,
                    index=curr_idx,
                    label_visibility="collapsed",
                    key="sidebar_ws_select",
                )

                # Update workspace id on change
                if selected_ws:
                    for w in workspaces:
                        if w.get("name") == selected_ws and str(w.get("_id")) != str(current_id):
                            st.session_state.current_ws_id = str(w.get("_id"))
                            st.rerun()

        st.markdown('<div class="ds-sidebar-sep"></div>', unsafe_allow_html=True)

        # Navigation (exact list, in exact order)
        # NOTE: Make sure these page paths match your actual files.
        _nav_item("Home", "Home.py", "home.svg")
        _nav_item("Workspaces", "pages/workspaces.py", "workspaces.svg")
        _nav_item("Projects", "pages/projects.py", "projects.svg")
        _nav_item("Tasks", "pages/tasks.py", "tasks.svg")
        _nav_item("Inbox", "pages/inbox.py", "inbox.svg")
        _nav_item("Profile", "pages/profile.py", "profile.svg")
        _nav_item("Settings", "pages/settings.py", "settings.svg")

        st.markdown('<div class="ds-sidebar-sep"></div>', unsafe_allow_html=True)

        # Log Out
        if st.button("Log Out", key="logout_btn", use_container_width=True):
            st.session_state.clear()
            st.switch_page("pages/sign-in.py")

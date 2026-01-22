import streamlit as st
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Task Templates", layout="wide")

# Global UI
render_custom_sidebar()
load_global_css()
hide_streamlit_sidebar()

# Auth guard (consistent behavior)
if "user_email" not in st.session_state:
    st.switch_page("pages/sign-in.py")

# Header (no emoji fallback, SVG only)
icon = get_svg("templates.svg", 28, 28)
st.markdown(
    f"""
    <div class="ds-page-head">
        <div class="ds-page-head-left">
            <div class="ds-page-icon">{icon}</div>
            <div class="ds-page-titles">
                <div class="ds-page-title">Task Templates</div>
                <div class="ds-page-subtitle">Create reusable task checklists and standard workflows.</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# Body (minimal placeholder until template CRUD is implemented)
st.markdown(
    """
    <div class="ds-card">
        <div class="ds-card-title">Templates</div>
        <div class="ds-card-subtitle">
            This area will let you create and manage task templates (for example: onboarding, QA, content publishing).
        </div>

        <div style="height:12px;"></div>

        <div class="ds-empty-mini">
            No templates to display yet.
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

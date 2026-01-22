import streamlit as st
from src.database import DreamShiftDB

st.set_page_config(
    page_title="Templates",
    page_icon="🎯",
    layout="wide",
)

from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

hide_streamlit_sidebar()
render_custom_sidebar()
load_global_css()

db = DreamShiftDB()

if "user_email" not in st.session_state:
    st.switch_page("pages/0_🚪_Sign_In.py")

if "current_ws_id" not in st.session_state:
    st.warning("Please select a workspace.")
    st.stop()

# --- HEADER ---
st.markdown(
    """
    <div class="ds-page-head">
      <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h1 class="ds-page-title" style="display:flex; align-items:center; gap:10px;">
                :material/extension: Task Templates
            </h1>
            <p class="ds-page-sub">Standardize your workflows</p>
          </div>
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# --- MASTER DETAIL LAYOUT ---
col_list, col_editor = st.columns([1, 2])

# 1. LIST (Left)
with col_list:
    st.markdown("##### SAVED TEMPLATES")
    templates = db.get_task_templates(st.session_state.current_ws_id) or []

    if st.button("+ Create New Template", use_container_width=True):
        st.session_state.selected_template = None
        st.rerun()

    if not templates:
        st.caption("No templates found.")

    for tpl in templates:
        tpl_id = str(tpl.get("_id"))
        active = st.session_state.get("selected_template") == tpl_id
        bg = "rgba(246,185,0,0.1)" if active else "rgba(255,255,255,0.05)"
        border = "#f6b900" if active else "rgba(255,255,255,0.1)"

        st.markdown(
            f"""
            <div style="padding:12px; background:{bg}; border:1px solid {border}; border-radius:8px; margin-bottom:8px;">
                <div style="font-weight:bold;">{tpl.get('name','')}</div>
                <div style="font-size:12px; opacity:0.7;">{len(tpl.get('items', []))} steps</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        if st.button("Select", key=f"sel_{tpl_id}", use_container_width=True):
            st.session_state.selected_template = tpl_id
            st.rerun()

# 2. EDITOR (Right)
with col_editor:
    tpl_id = st.session_state.get("selected_template")

    if tpl_id:
        tpl = db.get_task_template_by_id(st.session_state.current_ws_id, tpl_id)
        if tpl:
            st.markdown(f"### Editing: {tpl.get('name','')}")

            items = sorted(tpl.get("items", []), key=lambda x: x.get("order", 0))
            for item in items:
                with st.expander(f"{item.get('order', 0)}. {item.get('title', '')}", expanded=False):
                    st.write(f"**Desc:** {item.get('description', '-')}")
                    st.write(f"**Offset:** +{item.get('default_days_offset', 0)} days")
                    if st.button(
                        "Delete Step",
                        key=f"del_step_{tpl_id}_{item.get('order', 0)}",
                    ):
                        db.remove_task_template_item(
                            st.session_state.current_ws_id,
                            tpl_id,
                            item.get("order", 0),
                        )
                        st.rerun()

            st.markdown("---")
            st.markdown("**Add Step**")
            with st.form("add_step"):
                s_title = st.text_input("Step Title")
                s_days = st.number_input("Days after project start", min_value=0)
                if st.form_submit_button("Add Step"):
                    db.add_task_template_item(
                        st.session_state.current_ws_id,
                        tpl_id,
                        {
                            "title": s_title,
                            "default_days_offset": int(s_days),
                        },
                    )
                    st.rerun()

            if st.button(":material/delete: Delete Template", type="primary"):
                db.delete_task_template(tpl_id)
                st.session_state.selected_template = None
                st.rerun()

    else:
        st.markdown("### Create New Template")
        with st.form("new_tpl"):
            name = st.text_input("Template Name")
            desc = st.text_area("Description")
            if st.form_submit_button("Create"):
                new_id = db.create_task_template(
                    st.session_state.current_ws_id,
                    name,
                    desc,
                    [],
                    st.session_state.user_email,
                )
                st.session_state.selected_template = new_id
                st.rerun()


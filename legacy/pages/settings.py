import streamlit as st
from src.database import DreamShiftDB
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar, get_svg

st.set_page_config(page_title="Settings", layout="wide")
load_global_css()
hide_streamlit_sidebar()
render_custom_sidebar()
db = DreamShiftDB()

icon = get_svg("settings.svg", 36, 36) or ":material/settings:"
st.markdown(f"""<div class="ds-header-flex">{icon}<h1 class="ds-header-title">Settings</h1></div>""", unsafe_allow_html=True)

user = db.get_user(st.session_state.user_email)
prefs = user.get("preferences", {})

st.markdown("<div class='ds-section-title'>Notifications</div>", unsafe_allow_html=True)
email_notif = st.toggle("Receive Email Notifications", value=prefs.get("email_notifications", True))

if st.button("Save Changes"):
    db.db.users.update_one(
        {"email": st.session_state.user_email},
        {"$set": {"preferences": {"email_notifications": email_notif}}}
    )
    st.success("Preferences saved!")
import streamlit as st
from src.ui import load_global_css
from src.database import DreamShiftDB

st.set_page_config(page_title="Reset Password", layout="centered")
load_global_css()

try:
	db = DreamShiftDB()
	db_connected = True
except Exception as e:
	st.error(f"Database Connection Failed: {e}")
	db_connected = False

def get_query_token():
	try:
		params = st.query_params
		token = params.get("token")
	except Exception:
		params = st.experimental_get_query_params()
		token = params.get("token", [None])[0]

	if isinstance(token, list):
		return token[0] if token else None
	return token

token = get_query_token()

st.markdown('<div class="ds-login-wrap">', unsafe_allow_html=True)
st.markdown('<h2 class="ds-login-title" style="font-size:1.6rem;">Reset Password</h2>', unsafe_allow_html=True)

if not db_connected:
	st.markdown("</div>", unsafe_allow_html=True)
	st.stop()

if token:
	st.markdown('<p class="ds-login-subtitle">Enter your new password.</p>', unsafe_allow_html=True)
	with st.form("reset_form"):
		new_pass = st.text_input("New Password", type="password")
		confirm_pass = st.text_input("Confirm Password", type="password")
		if st.form_submit_button("Update Password", use_container_width=True):
			if len(new_pass) < 6:
				st.error("Password must be at least 6 characters.")
			elif new_pass != confirm_pass:
				st.error("Passwords do not match.")
			else:
				ok, msg = db.reset_password_with_token(token, new_pass)
				if ok:
					st.success("Password updated. You can sign in now.")
				else:
					st.error(msg)
else:
	st.markdown('<p class="ds-login-subtitle">Enter your email to receive a reset link.</p>', unsafe_allow_html=True)
	with st.form("request_form"):
		email = st.text_input("Email Address")
		if st.form_submit_button("Send Reset Link", use_container_width=True):
			if not email:
				st.error("Please enter your email address.")
			else:
				ok, msg = db.create_password_reset_token(email)
				if ok:
					st.success("If the email exists, a reset link has been sent.")
				else:
					st.error(msg)

st.markdown("</div>", unsafe_allow_html=True)
if st.button("Back"):
	st.switch_page("pages/sign-in.py")
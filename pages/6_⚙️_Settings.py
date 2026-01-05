import streamlit as st
from src.database import DreamShiftDB
import hashlib

st.set_page_config(page_title="⚙️ Settings", page_icon="⚙️", layout="wide")

# Load custom CSS
with open('static/styles.css') as f:
    st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)

db = DreamShiftDB()

# Check authentication
if "user_email" not in st.session_state:
    st.error("Please login first")
    st.stop()

user = db.get_user(st.session_state.user_email)

st.title("⚙️ Settings")

# Tabs for different settings
tab1, tab2, tab3, tab4 = st.tabs(["🎨 Appearance", "🔔 Notifications", "🔐 Security", "🔗 Integrations"])

with tab1:
    st.markdown("### 🎨 Appearance Settings")
    
    st.markdown("""
        <div class="custom-card">
            <h4 style="color: #f6b900;">Theme</h4>
            <p style="color: rgba(255, 255, 255, 0.7);">Choose your preferred color theme</p>
        </div>
    """, unsafe_allow_html=True)
    
    current_theme = user.get('preferences', {}).get('theme', 'dark')
    theme = st.radio(
        "Select Theme",
        options=["dark", "light"],
        index=0 if current_theme == "dark" else 1,
        horizontal=True
    )
    
    if theme != current_theme:
        if st.button("Apply Theme"):
            db.update_user_profile(user['email'], {
                "preferences.theme": theme
            })
            st.success("Theme updated! Refresh the page to see changes.")
    
    st.markdown("---")
    
    st.markdown("""
        <div class="custom-card">
            <h4 style="color: #f6b900;">Display Options</h4>
            <p style="color: rgba(255, 255, 255, 0.7);">Customize your dashboard view</p>
        </div>
    """, unsafe_allow_html=True)
    
    show_completed = st.checkbox("Show completed tasks on dashboard", value=True)
    compact_view = st.checkbox("Use compact view for task lists", value=False)
    show_avatars = st.checkbox("Show user avatars", value=True)
    
    if st.button("Save Display Settings"):
        st.success("Display settings saved!")

with tab2:
    st.markdown("### 🔔 Notification Settings")
    
    st.markdown("""
        <div class="custom-card">
            <h4 style="color: #f6b900;">Email Notifications</h4>
            <p style="color: rgba(255, 255, 255, 0.7);">Control when you receive email notifications</p>
        </div>
    """, unsafe_allow_html=True)
    
    email_notifications = st.checkbox(
        "Enable email notifications",
        value=user.get('preferences', {}).get('email_notifications', True)
    )
    
    if email_notifications:
        notification_frequency = st.radio(
            "Email Frequency",
            options=["immediate", "daily", "weekly"],
            index=["immediate", "daily", "weekly"].index(
                user.get('preferences', {}).get('notification_frequency', 'immediate')
            ),
            format_func=lambda x: {
                "immediate": "Immediate - Send emails as events happen",
                "daily": "Daily Digest - One email per day",
                "weekly": "Weekly Summary - One email per week"
            }[x]
        )
    else:
        notification_frequency = "immediate"
    
    st.markdown("---")
    
    st.markdown("**Notification Types**")
    st.markdown("Choose which events trigger notifications:")
    
    col1, col2 = st.columns(2)
    
    with col1:
        notify_task_assigned = st.checkbox("New task assignments", value=True)
        notify_mentions = st.checkbox("@mentions in comments", value=True)
        notify_comments = st.checkbox("New comments on my tasks", value=True)
        notify_deadlines = st.checkbox("Upcoming deadlines", value=True)
    
    with col2:
        notify_status_changes = st.checkbox("Task status changes", value=True)
        notify_extensions = st.checkbox("Extension request updates", value=True)
        notify_recurring = st.checkbox("Recurring task reminders", value=True)
        notify_overdue = st.checkbox("Overdue task alerts", value=True)
    
    if st.button("Save Notification Settings"):
        db.update_user_profile(user['email'], {
            "preferences": {
                "email_notifications": email_notifications,
                "notification_frequency": notification_frequency,
                "theme": user.get('preferences', {}).get('theme', 'light')
            }
        })
        st.success("Notification settings saved!")

with tab3:
    st.markdown("### 🔐 Security Settings")
    
    st.markdown("""
        <div class="custom-card">
            <h4 style="color: #f6b900;">Change Password</h4>
            <p style="color: rgba(255, 255, 255, 0.7);">Update your account password</p>
        </div>
    """, unsafe_allow_html=True)
    
    with st.form("change_password"):
        current_password = st.text_input("Current Password", type="password")
        new_password = st.text_input("New Password", type="password")
        confirm_password = st.text_input("Confirm New Password", type="password")
        
        if st.form_submit_button("Change Password"):
            # Verify current password
            hashed_current = hashlib.sha256(current_password.encode()).hexdigest()
            if hashed_current != user['password']:
                st.error("Current password is incorrect!")
            elif new_password != confirm_password:
                st.error("New passwords don't match!")
            elif len(new_password) < 6:
                st.error("Password must be at least 6 characters long!")
            else:
                hashed_new = hashlib.sha256(new_password.encode()).hexdigest()
                db.update_user_profile(user['email'], {"password": hashed_new})
                st.success("Password changed successfully!")
    
    st.markdown("---")
    
    st.markdown("""
        <div class="custom-card">
            <h4 style="color: #f6b900;">Account Security</h4>
            <p style="color: rgba(255, 255, 255, 0.7);">Additional security options</p>
        </div>
    """, unsafe_allow_html=True)
    
    st.info("💡 **Security Tips:**\n- Use a strong, unique password\n- Don't share your credentials\n- Log out from shared devices\n- Report suspicious activity to your admin")

with tab4:
    st.markdown("### 🔗 Integrations")
    
    st.markdown("""
        <div class="custom-card">
            <h4 style="color: #f6b900;">Calendar Sync</h4>
            <p style="color: rgba(255, 255, 255, 0.7);">Sync your tasks with external calendars</p>
        </div>
    """, unsafe_allow_html=True)
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.markdown("**Google Calendar**")
        st.write("Sync your task deadlines and meetings to Google Calendar")
        
        # Check if already connected (you would store this in user preferences)
        is_connected = user.get('preferences', {}).get('google_calendar_connected', False)
        
        if is_connected:
            st.success("✅ Connected to Google Calendar")
            if st.button("Disconnect"):
                db.update_user_profile(user['email'], {
                    "preferences.google_calendar_connected": False
                })
                st.rerun()
        else:
            if st.button("🔗 Connect Google Calendar"):
                st.info("Calendar sync will be set up. You'll be redirected to Google for authorization.")
                # In a real implementation, you would:
                # 1. Use Google OAuth to get credentials
                # 2. Store refresh token in user preferences
                # 3. Use it to sync events
    
    with col2:
        st.markdown("**Status**")
        if is_connected:
            st.write("🟢 Active")
            st.caption("Last synced: Just now")
        else:
            st.write("⚪ Not connected")
    
    st.markdown("---")
    
    st.markdown("""
        <div class="custom-card">
            <h4 style="color: #f6b900;">Slack Integration</h4>
            <p style="color: rgba(255, 255, 255, 0.7);">Get notifications in Slack</p>
        </div>
    """, unsafe_allow_html=True)
    
    st.info("Coming soon! Receive task notifications directly in your Slack workspace.")
    
    st.markdown("---")
    
    st.markdown("""
        <div class="custom-card">
            <h4>iCal Feed</h4>
            <p style="color: rgba(255, 255, 255, 0.7);">Subscribe to your tasks in any calendar app</p>
        </div>
    """, unsafe_allow_html=True)
    
    # Generate a unique feed URL (in production, this would be a real URL)
    feed_url = f"https://dreamshift.app/ical/{hashlib.md5(user['email'].encode()).hexdigest()}"
    
    st.code(feed_url, language="text")
    st.caption("Copy this URL and add it as a calendar subscription in your calendar app (Apple Calendar, Outlook, etc.)")
    
    if st.button("📋 Copy Feed URL"):
        st.success("URL copied to clipboard! (In production)")

# Danger Zone
st.markdown("---")
st.markdown("### ⚠️ Danger Zone")

with st.expander("🗑️ Delete Account", expanded=False):
    st.warning("**Warning:** This action cannot be undone. All your data will be permanently deleted.")
    
    st.markdown("Deleting your account will:")
    st.markdown("- Remove all your personal data")
    st.markdown("- Unassign you from all tasks")
    st.markdown("- Remove you from all workspaces")
    st.markdown("- Delete all your comments and time logs")
    
    confirm_text = st.text_input("Type 'DELETE' to confirm")
    
    if st.button("Delete My Account", type="primary"):
        if confirm_text == "DELETE":
            st.error("Account deletion is not yet implemented. Please contact your administrator.")
        else:
            st.error("Please type 'DELETE' to confirm")

# Footer
st.markdown("---")
st.markdown("""
    <div style="text-align: center; color: rgba(255, 255, 255, 0.7);">
        <p>DreamShift EMS v1.0 • <a href="#" style="color: #f6b900;">Help Center</a> • 
        <a href="#" style="color: #f6b900;">Privacy Policy</a> • 
        <a href="#" style="color: #f6b900;">Terms of Service</a></p>
    </div>
""", unsafe_allow_html=True)

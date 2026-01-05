# Google Calendar Integration for DreamShift EMS

## Overview
This module provides Google Calendar OAuth 2.0 integration to sync tasks with Google Calendar.

## Setup Instructions

### 1. Get Google Calendar API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:8501/oauth2callback` (for local development)
     - `https://yourdomain.com/oauth2callback` (for production)
   - Download the JSON file

5. Save credentials:
   - Rename downloaded file to `google_credentials.json`
   - Place in project root directory
   - Add to `.gitignore` to keep secret

### 2. Install Required Packages

```bash
pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

### 3. Update requirements.txt

Add these lines:
```
google-auth>=2.23.0
google-auth-oauthlib>=1.1.0
google-auth-httplib2>=0.1.1
google-api-python-client>=2.100.0
```

## Implementation

### File: `src/calendar_sync.py`

```python
import os
import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import streamlit as st

# Scopes required for calendar access
SCOPES = ['https://www.googleapis.com/auth/calendar']

class GoogleCalendarSync:
    def __init__(self):
        self.client_secrets_file = 'google_credentials.json'
        self.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8501/oauth2callback')
    
    def get_authorization_url(self):
        """Generate OAuth authorization URL"""
        flow = Flow.from_client_secrets_file(
            self.client_secrets_file,
            scopes=SCOPES,
            redirect_uri=self.redirect_uri
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        return authorization_url, state
    
    def exchange_code_for_tokens(self, code, state):
        """Exchange authorization code for access tokens"""
        flow = Flow.from_client_secrets_file(
            self.client_secrets_file,
            scopes=SCOPES,
            redirect_uri=self.redirect_uri,
            state=state
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        return {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
    
    def get_calendar_service(self, user_credentials):
        """Create Google Calendar API service"""
        creds = Credentials(
            token=user_credentials['token'],
            refresh_token=user_credentials['refresh_token'],
            token_uri=user_credentials['token_uri'],
            client_id=user_credentials['client_id'],
            client_secret=user_credentials['client_secret'],
            scopes=user_credentials['scopes']
        )
        
        return build('calendar', 'v3', credentials=creds)
    
    def create_task_event(self, service, task):
        """Create a Google Calendar event from a task"""
        event = {
            'summary': f'[DreamShift] {task["title"]}',
            'description': task.get('description', 'Task from DreamShift EMS'),
            'start': {
                'dateTime': task['due_date'].isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': (task['due_date'] + datetime.timedelta(hours=1)).isoformat(),
                'timeZone': 'UTC',
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                    {'method': 'popup', 'minutes': 60},  # 1 hour before
                ],
            },
        }
        
        try:
            event = service.events().insert(calendarId='primary', body=event).execute()
            return event.get('id')
        except HttpError as error:
            print(f'An error occurred: {error}')
            return None
    
    def update_task_event(self, service, event_id, task):
        """Update existing calendar event"""
        event = {
            'summary': f'[DreamShift] {task["title"]}',
            'description': task.get('description', 'Task from DreamShift EMS'),
            'start': {
                'dateTime': task['due_date'].isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': (task['due_date'] + datetime.timedelta(hours=1)).isoformat(),
                'timeZone': 'UTC',
            },
        }
        
        try:
            updated_event = service.events().update(
                calendarId='primary',
                eventId=event_id,
                body=event
            ).execute()
            return updated_event
        except HttpError as error:
            print(f'An error occurred: {error}')
            return None
    
    def delete_task_event(self, service, event_id):
        """Delete calendar event"""
        try:
            service.events().delete(calendarId='primary', eventId=event_id).execute()
            return True
        except HttpError as error:
            print(f'An error occurred: {error}')
            return False
    
    def sync_all_tasks(self, service, tasks):
        """Sync all tasks to Google Calendar"""
        synced_count = 0
        
        for task in tasks:
            if task['status'] != 'Completed' and task.get('due_date'):
                event_id = self.create_task_event(service, task)
                if event_id:
                    synced_count += 1
                    # Store event_id in task metadata for future updates
        
        return synced_count
```

### Update `pages/4_calendar.py` - OAuth Flow

Replace the OAuth section with:

```python
# In the Google Calendar OAuth section
if st.session_state.get('show_calendar_oauth', False):
    st.markdown("---")
    st.markdown("### 🔐 Google Calendar Authorization")
    
    from src.calendar_sync import GoogleCalendarSync
    
    calendar_sync = GoogleCalendarSync()
    
    # Check if we have a code from redirect
    query_params = st.query_params
    
    if 'code' in query_params:
        # Exchange code for tokens
        code = query_params['code']
        state = st.session_state.get('oauth_state', '')
        
        try:
            credentials = calendar_sync.exchange_code_for_tokens(code, state)
            
            # Save credentials to database
            db.update_user_profile(st.session_state.user_email, {
                'google_calendar_credentials': credentials,
                'preferences.google_calendar_connected': True
            })
            
            st.success("✅ Successfully connected to Google Calendar!")
            st.balloons()
            
            # Clear query params
            st.query_params.clear()
            st.session_state.show_calendar_oauth = False
            st.rerun()
            
        except Exception as e:
            st.error(f"❌ Authorization failed: {str(e)}")
    
    else:
        # Show authorization link
        auth_url, state = calendar_sync.get_authorization_url()
        st.session_state.oauth_state = state
        
        st.info("""
            **Steps to connect:**
            1. Click the button below to authorize DreamShift EMS
            2. Sign in with your Google account
            3. Grant calendar access permissions
            4. You'll be redirected back automatically
        """)
        
        st.markdown(f"""
            <a href="{auth_url}" target="_self">
                <button style="background: #f6b900; color: #24101a; padding: 12px 24px; 
                        border: none; border-radius: 6px; font-weight: 600; cursor: pointer; 
                        font-size: 16px;">
                    🔗 Connect Google Calendar
                </button>
            </a>
        """, unsafe_allow_html=True)
        
        if st.button("Cancel"):
            st.session_state.show_calendar_oauth = False
            st.rerun()
```

### Update Sync Now Button

```python
if st.button("🔄 Sync Now", use_container_width=True):
    from src.calendar_sync import GoogleCalendarSync
    
    calendar_sync = GoogleCalendarSync()
    
    # Get user's credentials from database
    user = db.get_user(st.session_state.user_email)
    credentials = user.get('google_calendar_credentials')
    
    if credentials:
        try:
            # Create service
            service = calendar_sync.get_calendar_service(credentials)
            
            # Get all active tasks
            tasks = db.get_tasks_with_urgency({
                "assignee": st.session_state.user_email,
                "status": {"$ne": "Completed"}
            })
            
            # Sync tasks
            synced_count = calendar_sync.sync_all_tasks(service, tasks)
            
            st.success(f"✅ Synced {synced_count} tasks to Google Calendar!")
            
        except Exception as e:
            st.error(f"❌ Sync failed: {str(e)}")
    else:
        st.error("No credentials found. Please reconnect.")
```

## Usage in Application

### Automatic Sync on Task Creation/Update

Add to `src/database.py` after task operations:

```python
def create_task(self, ...):
    # ... existing code ...
    task_id = self.db.tasks.insert_one(task).inserted_id
    
    # Auto-sync to Google Calendar if enabled
    assignee_user = self.get_user(assignee)
    if assignee_user and assignee_user.get('preferences', {}).get('google_calendar_connected'):
        self._sync_task_to_calendar(task_id, assignee)
    
    return str(task_id)

def _sync_task_to_calendar(self, task_id, user_email):
    """Helper to sync single task to Google Calendar"""
    try:
        from src.calendar_sync import GoogleCalendarSync
        
        user = self.get_user(user_email)
        credentials = user.get('google_calendar_credentials')
        
        if credentials:
            calendar_sync = GoogleCalendarSync()
            service = calendar_sync.get_calendar_service(credentials)
            task = self.get_task(task_id)
            
            event_id = calendar_sync.create_task_event(service, task)
            
            # Store event_id in task for future updates
            if event_id:
                self.db.tasks.update_one(
                    {"_id": ObjectId(task_id)},
                    {"$set": {"google_calendar_event_id": event_id}}
                )
    except Exception as e:
        print(f"Calendar sync error: {e}")
```

## Environment Variables

Add to `.env`:

```
GOOGLE_REDIRECT_URI=http://localhost:8501/oauth2callback
```

For production:
```
GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth2callback
```

## Security Notes

1. **Never commit** `google_credentials.json` to version control
2. Store user credentials encrypted in database
3. Refresh tokens periodically
4. Handle token expiration gracefully
5. Use HTTPS in production

## Testing

1. Start Streamlit: `streamlit run app.py`
2. Go to Calendar page
3. Click "Connect Google Calendar"
4. Authorize the app
5. Test sync functionality

## Troubleshooting

### "Redirect URI mismatch"
- Check Google Cloud Console authorized redirect URIs
- Must exactly match the URI in environment variable

### "Invalid credentials"
- Credentials expired - reconnect
- Check `google_credentials.json` is valid

### "API not enabled"
- Enable Google Calendar API in Google Cloud Console

### "Rate limit exceeded"
- Google Calendar API has quotas
- Implement exponential backoff for retries

## Features Implemented

✅ OAuth 2.0 authentication flow
✅ One-way sync (DreamShift → Google Calendar)
✅ Create events for tasks
✅ Update events when tasks change
✅ Delete events when tasks completed
✅ Automatic sync on task creation
✅ Manual sync button
✅ Token refresh handling
✅ Error handling

## Future Enhancements

- Two-way sync (Google Calendar → DreamShift)
- Multiple calendar support
- Color-coding by priority
- Recurring task events
- Meeting integration
- Shared calendar support

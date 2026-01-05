"""
Google Calendar Integration for DreamShift EMS
Handles OAuth 2.0 flow and task synchronization with Google Calendar
"""

import os
import datetime
from typing import Dict, List, Optional
import streamlit as st

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    GOOGLE_CALENDAR_AVAILABLE = True
except ImportError:
    GOOGLE_CALENDAR_AVAILABLE = False
    print("Google Calendar integration not available. Install: pip install google-auth google-auth-oauthlib google-api-python-client")

# Scopes required for calendar access
SCOPES = ['https://www.googleapis.com/auth/calendar']

class GoogleCalendarSync:
    """Handles Google Calendar OAuth and task synchronization"""
    
    def __init__(self):
        if not GOOGLE_CALENDAR_AVAILABLE:
            raise ImportError("Google Calendar libraries not installed")
        
        self.client_secrets_file = 'google_credentials.json'
        self.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8501/oauth2callback')
    
    def get_authorization_url(self) -> tuple:
        """
        Generate OAuth 2.0 authorization URL
        
        Returns:
            tuple: (authorization_url, state)
        """
        if not os.path.exists(self.client_secrets_file):
            raise FileNotFoundError(
                f"Google credentials file not found: {self.client_secrets_file}\n"
                "Please download from Google Cloud Console and place in project root."
            )
        
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
    
    def exchange_code_for_tokens(self, code: str, state: str) -> Dict:
        """
        Exchange authorization code for access and refresh tokens
        
        Args:
            code: Authorization code from OAuth callback
            state: State parameter for security
        
        Returns:
            dict: Credentials dictionary with tokens
        """
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
    
    def get_calendar_service(self, user_credentials: Dict):
        """
        Create Google Calendar API service instance
        
        Args:
            user_credentials: Dictionary containing OAuth tokens
        
        Returns:
            Google Calendar service object
        """
        creds = Credentials(
            token=user_credentials['token'],
            refresh_token=user_credentials['refresh_token'],
            token_uri=user_credentials['token_uri'],
            client_id=user_credentials['client_id'],
            client_secret=user_credentials['client_secret'],
            scopes=user_credentials['scopes']
        )
        
        return build('calendar', 'v3', credentials=creds)
    
    def create_task_event(self, service, task: Dict) -> Optional[str]:
        """
        Create a Google Calendar event from a DreamShift task
        
        Args:
            service: Google Calendar service instance
            task: Task dictionary from database
        
        Returns:
            str: Event ID if successful, None otherwise
        """
        # Convert due date to proper format
        due_date = task['due_date']
        if not isinstance(due_date, datetime.datetime):
            due_date = datetime.datetime.combine(due_date, datetime.time(9, 0))
        
        event = {
            'summary': f'[DreamShift] {task["title"]}',
            'description': f'{task.get("description", "")}\n\nProject: {task.get("project_name", "N/A")}\nPriority: {task.get("priority", "Normal")}\n\n🔗 View in DreamShift EMS',
            'start': {
                'dateTime': due_date.isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': (due_date + datetime.timedelta(hours=1)).isoformat(),
                'timeZone': 'UTC',
            },
            'colorId': self._get_color_id(task.get('priority', 'Normal')),
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                    {'method': 'popup', 'minutes': 60},  # 1 hour before
                ],
            },
        }
        
        try:
            created_event = service.events().insert(calendarId='primary', body=event).execute()
            return created_event.get('id')
        except HttpError as error:
            st.error(f'Error creating calendar event: {error}')
            return None
    
    def update_task_event(self, service, event_id: str, task: Dict) -> bool:
        """
        Update existing calendar event
        
        Args:
            service: Google Calendar service instance
            event_id: Google Calendar event ID
            task: Updated task dictionary
        
        Returns:
            bool: True if successful, False otherwise
        """
        due_date = task['due_date']
        if not isinstance(due_date, datetime.datetime):
            due_date = datetime.datetime.combine(due_date, datetime.time(9, 0))
        
        event = {
            'summary': f'[DreamShift] {task["title"]}',
            'description': f'{task.get("description", "")}\n\nProject: {task.get("project_name", "N/A")}\nPriority: {task.get("priority", "Normal")}',
            'start': {
                'dateTime': due_date.isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': (due_date + datetime.timedelta(hours=1)).isoformat(),
                'timeZone': 'UTC',
            },
            'colorId': self._get_color_id(task.get('priority', 'Normal')),
        }
        
        try:
            service.events().update(
                calendarId='primary',
                eventId=event_id,
                body=event
            ).execute()
            return True
        except HttpError as error:
            st.error(f'Error updating calendar event: {error}')
            return False
    
    def delete_task_event(self, service, event_id: str) -> bool:
        """
        Delete calendar event
        
        Args:
            service: Google Calendar service instance
            event_id: Google Calendar event ID
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            service.events().delete(calendarId='primary', eventId=event_id).execute()
            return True
        except HttpError as error:
            st.error(f'Error deleting calendar event: {error}')
            return False
    
    def sync_all_tasks(self, service, tasks: List[Dict]) -> int:
        """
        Sync all tasks to Google Calendar
        
        Args:
            service: Google Calendar service instance
            tasks: List of task dictionaries
        
        Returns:
            int: Number of tasks successfully synced
        """
        synced_count = 0
        
        for task in tasks:
            # Only sync active tasks with due dates
            if task['status'] != 'Completed' and task.get('due_date'):
                # Check if already has calendar event
                if task.get('google_calendar_event_id'):
                    # Update existing event
                    if self.update_task_event(service, task['google_calendar_event_id'], task):
                        synced_count += 1
                else:
                    # Create new event
                    event_id = self.create_task_event(service, task)
                    if event_id:
                        synced_count += 1
                        # Note: You should update the task in database with event_id
        
        return synced_count
    
    def _get_color_id(self, priority: str) -> str:
        """
        Map task priority to Google Calendar color
        
        Args:
            priority: Task priority (Urgent, High, Normal, Low)
        
        Returns:
            str: Google Calendar color ID
        """
        color_map = {
            'Urgent': '11',  # Red
            'High': '9',     # Blue
            'Normal': '5',   # Yellow
            'Low': '2'       # Green
        }
        return color_map.get(priority, '5')


# Helper function to check if Google Calendar is available
def is_google_calendar_available() -> bool:
    """Check if Google Calendar integration is available"""
    return GOOGLE_CALENDAR_AVAILABLE


# Singleton instance
_calendar_sync = None

def get_calendar_sync() -> GoogleCalendarSync:
    """Get or create GoogleCalendarSync instance"""
    global _calendar_sync
    if _calendar_sync is None and GOOGLE_CALENDAR_AVAILABLE:
        _calendar_sync = GoogleCalendarSync()
    return _calendar_sync

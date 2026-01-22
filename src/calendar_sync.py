"""
Google Calendar Integration for DreamShift EMS
Handles OAuth 2.0 flow and task synchronization with Google Calendar
"""

import os
import datetime
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/calendar']

def authorize_gcal():
    """
    Handles Google Calendar OAuth2 authorization.
    Returns: google.oauth2.credentials.Credentials object or None
    """
    creds = None
    # The file token.pickle stores the user's access and refresh tokens
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            try:
                creds = pickle.load(token)
            except Exception:
                creds = None
                
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                creds = None

        if not creds:
            # Check if credentials.json exists
            if not os.path.exists('credentials.json'):
                # Return None if no credentials file found
                # (Caller should handle the "missing credentials.json" error)
                return None
                
            try:
                flow = InstalledAppFlow.from_client_secrets_file(
                    'credentials.json', SCOPES)
                creds = flow.run_local_server(port=0)
            except Exception as e:
                print(f"Authorization failed: {e}")
                return None

        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)

    return creds

def sync_all_tasks_to_gcal(db, user_email, creds):
    """
    Syncs all active tasks for the user to their Google Calendar.
    Returns: Number of tasks synced (int)
    """
    if not creds:
        return 0

    try:
        service = build('calendar', 'v3', credentials=creds)
        
        # 1. Fetch active tasks for the user
        tasks = db.get_tasks_with_urgency({"assignee": user_email, "status": {"$ne": "Completed"}})
        
        count = 0
        for task in tasks:
            if not task.get('due_date'):
                continue

            # Check if already synced (you might want to store gcal_event_id in db to avoid dupes)
            # For simplicity, this example just adds events. 
            # In production, check task.get('gcal_event_id') first.

            event_body = {
                'summary': f"DreamShift: {task['title']}",
                'description': f"Project: {task.get('project_name', 'N/A')}\nPriority: {task.get('priority', 'Medium')}",
                'start': {
                    'dateTime': task['due_date'].isoformat(),
                    'timeZone': 'UTC',  # Adjust as needed
                },
                'end': {
                    'dateTime': (task['due_date'] + datetime.timedelta(hours=1)).isoformat(),
                    'timeZone': 'UTC',
                },
            }

            try:
                service.events().insert(calendarId='primary', body=event_body).execute()
                count += 1
            except Exception as e:
                print(f"Failed to sync task {task['title']}: {e}")
                
        return count

    except Exception as e:
        print(f"Sync failed: {e}")
        return 0

import os
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

def get_google_auth_flow():
    return Flow.from_client_config(
        {"web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://accounts.google.com/o/oauth2/token",
        }},
        scopes=["https://www.googleapis.com/auth/calendar.events"]
    )

def push_to_calendar(creds, title, date):
    service = build("calendar", "v3", credentials=creds)
    event = {
        'summary': f'DreamShift: {title}',
        'start': {'date': date.strftime('%Y-%m-%d')},
        'end': {'date': date.strftime('%Y-%m-%d')},
    }
    return service.events().insert(calendarId='primary', body=event).execute()
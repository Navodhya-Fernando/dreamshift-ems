import os
import datetime
from pymongo import MongoClient
from bson.objectid import ObjectId
import bcrypt

class DreamShiftDB:
    def __init__(self):
        # Connect to MongoDB
        MONGO_URI = os.getenv("MONGO_URI")
        DB_NAME = os.getenv("DB_NAME", "dreamshift_db")
        if not MONGO_URI:
            raise ValueError("MONGO_URI not set in environment variables.")
        self.client = MongoClient(MONGO_URI)
        self.db = self.client[DB_NAME]

    # --- USER & AUTH ---
    def get_user(self, email):
        return self.db.users.find_one({"email": email})

    def authenticate_user(self, email, password):
        user = self.get_user(email)
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            return user
        return None

    # --- NOTIFICATIONS (New) ---
    def create_notification(self, user_email, title, message, notif_type="info", link=None):
        """Types: info, warning, mention, deadline"""
        self.db.notifications.insert_one({
            "user_email": user_email,
            "title": title,
            "message": message,
            "type": notif_type,
            "link": link,
            "read": False,
            "created_at": datetime.datetime.utcnow()
        })

    def get_unread_notifications(self, user_email):
        return list(self.db.notifications.find({"user_email": user_email, "read": False}).sort("created_at", -1))

    def mark_notification_read(self, notif_id):
        self.db.notifications.update_one({"_id": ObjectId(notif_id)}, {"$set": {"read": True}})

    # --- WORKSPACES & STATUSES ---
    def get_workspace_statuses(self, workspace_id):
        ws = self.db.workspaces.find_one({"_id": ObjectId(workspace_id)})
        return ws.get("custom_statuses", ["To Do", "In Progress", "Completed"]) if ws else ["To Do", "In Progress", "Completed"]

    def update_workspace_statuses(self, workspace_id, statuses):
        self.db.workspaces.update_one({"_id": ObjectId(workspace_id)}, {"$set": {"custom_statuses": statuses}})

    # --- TASKS ---
    def get_tasks(self, query):
        return list(self.db.tasks.find(query))

    def create_task(self, ws_id, title, desc, due_date, assignee, status, priority, project_id, creator_email):
        task_id = self.db.tasks.insert_one({
            "workspace_id": ws_id,
            "title": title,
            "description": desc,
            "due_date": due_date,
            "assignee": assignee,
            "status": status,
            "priority": priority,
            "project_id": project_id,
            "created_by": creator_email,
            "created_at": datetime.datetime.utcnow()
        }).inserted_id
        
        # Notify Assignee
        if assignee and assignee != creator_email:
            self.create_notification(assignee, "New Task Assigned", f"You were assigned: {title}", "info")
        
        return str(task_id)

    def update_task_status(self, task_id, status):
        self.db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": {"status": status}})

    # --- LOG TIME ---
    def log_time(self, task_id, user_email, seconds):
        self.db.time_logs.insert_one({
            "task_id": task_id,
            "user_email": user_email,
            "seconds": seconds,
            "date": datetime.datetime.utcnow()
        })

    # --- MENTIONS ---
    def handle_mentions(self, text, source_user, link):
        """Parse @mentions and notify users"""
        import re
        emails = re.findall(r"@[\w\.-]+@[\w\.-]+", text)
        for email in emails:
            clean_email = email[1:] # remove @
            self.create_notification(clean_email, "You were mentioned", f"{source_user} mentioned you.", "mention", link)

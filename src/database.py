import os
import datetime
from pymongo import MongoClient
from bson.objectid import ObjectId
import bcrypt

class DreamShiftDB:
    def __init__(self):
        # UPDATED: Matches your .env variable name 'MONGODB_URI'
        MONGO_URI = os.getenv("MONGODB_URI") 
        DB_NAME = os.getenv("DB_NAME", "dreamshift")
        
        if not MONGO_URI:
            raise ValueError("MONGODB_URI not found in .env file.")
            
        try:
            self.client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            # Trigger a connection check immediately
            self.client.admin.command('ping')
            self.db = self.client[DB_NAME]
            print("✅ MongoDB connected successfully")
        except Exception as e:
            print(f"❌ MongoDB Connection Failed: {e}")
            print("   Make sure:")
            print("   1. MONGODB_URI in .env is correct")
            print("   2. Your IP is whitelisted in MongoDB Atlas Network Access")
            print("   3. Credentials (username/password) are correct")
            raise e

    # --- AUTHENTICATION ---
    def create_user(self, email, password, name):
        """Creates a new user in the database"""
        # Check if user exists
        if self.db.users.find_one({"email": email}):
            return False, "Email already registered."
        
        # Hash password
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        user_doc = {
            "email": email,
            "password": hashed,
            "name": name,
            "created_at": datetime.datetime.utcnow(),
            "preferences": {"email_notifications": True},
            "role": "Member" # Default role
        }
        self.db.users.insert_one(user_doc)
        return True, "Account created successfully."

    def authenticate_user(self, email, password):
        user = self.db.users.find_one({"email": email})
        if user:
            # Password is stored as bcrypt hash (string), convert to bytes for comparison
            try:
                if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                    return user
            except (ValueError, AttributeError):
                # Fallback: If hash is invalid, try plain text comparison (for testing only)
                if user['password'] == password:
                    return user
                return None
        return None

    # --- WORKSPACES ---
    def get_user_workspaces(self, email):
        return list(self.db.workspaces.find({"members.email": email}))
    
    def get_user_role(self, ws_id, email):
        ws = self.db.workspaces.find_one({"_id": ObjectId(ws_id)})
        if ws:
            for m in ws.get('members', []):
                if m['email'] == email:
                    return m.get('role', 'Member')
        return "Guest"

    def get_workspace_statuses(self, workspace_id):
        ws = self.db.workspaces.find_one({"_id": ObjectId(workspace_id)})
        return ws.get("custom_statuses", ["To Do", "In Progress", "Completed"]) if ws else ["To Do", "In Progress", "Completed"]

    def update_workspace_statuses(self, workspace_id, statuses):
        self.db.workspaces.update_one({"_id": ObjectId(workspace_id)}, {"$set": {"custom_statuses": statuses}})

    # --- TASKS ---
    def get_tasks_with_urgency(self, query):
        tasks = list(self.db.tasks.find(query))
        now = datetime.datetime.utcnow()
        for t in tasks:
            t['urgency_color'] = "#28a745" # Green
            if t.get('due_date'):
                diff = (t['due_date'] - now).total_seconds() / 3600
                if diff < 24: t['urgency_color'] = "#dc3545" # Red
                elif diff < 72: t['urgency_color'] = "#ffc107" # Yellow
        return tasks

    def create_task(self, ws_id, title, desc, due_date, assignee, status, priority, project_id, creator):
        self.db.tasks.insert_one({
            "workspace_id": ws_id,
            "title": title,
            "description": desc,
            "due_date": due_date,
            "assignee": assignee,
            "status": status,
            "priority": priority,
            "project_id": project_id,
            "created_by": creator,
            "created_at": datetime.datetime.utcnow()
        })
        # Notify
        if assignee and assignee != creator:
            self.create_notification(assignee, "New Task", f"Assigned: {title}", "info")

    def update_task_status(self, task_id, status):
        self.db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": {"status": status}})

    # --- NOTIFICATIONS ---
    def get_unread_notifications(self, email):
        return list(self.db.notifications.find({"user_email": email, "read": False}).sort("created_at", -1))

    def create_notification(self, email, title, msg, n_type="info", link=None):
        self.db.notifications.insert_one({
            "user_email": email, "title": title, "message": msg,
            "type": n_type, "link": link, "read": False,
            "created_at": datetime.datetime.utcnow()
        })
    
    def mark_notification_read(self, nid):
        self.db.notifications.update_one({"_id": ObjectId(nid)}, {"$set": {"read": True}})

    def handle_mentions(self, text, source_user, link):
        import re
        emails = re.findall(r"@([\w\.-]+@[\w\.-]+)", text)
        for email in emails:
            self.create_notification(email, "Mentioned", f"{source_user} mentioned you.", "mention", link)

    # --- STATS ---
    def get_user_stats(self, email):
        total = self.db.tasks.count_documents({"assignee": email})
        completed = self.db.tasks.count_documents({"assignee": email, "status": "Completed"})
        rate = int((completed / total * 100) if total > 0 else 0)
        return {"assigned": total, "completed": completed, "rate": rate, "week_hours": 0} # Hours placeholder
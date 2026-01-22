import os
import datetime
from pymongo import MongoClient
from bson.objectid import ObjectId
import bcrypt

class DreamShiftDB:
    def __init__(self):
        MONGO_URI = os.getenv("MONGODB_URI")
        DB_NAME = os.getenv("DB_NAME", "dreamshift")
        
        if not MONGO_URI:
            raise ValueError("MONGODB_URI not found in .env file.")
            
        try:
            self.client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            self.client.admin.command('ping')
            self.db = self.client[DB_NAME]
            self.ObjectId = ObjectId  # Expose ObjectId for pages
        except Exception as e:
            print(f"❌ MongoDB Connection Failed: {e}")
            raise e

    # --- AUTHENTICATION ---
    def create_user(self, email, password, name):
        if self.db.users.find_one({"email": email}):
            return False, "Email already registered."
        
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user_doc = {
            "email": email,
            "password": hashed,
            "name": name,
            "created_at": datetime.datetime.utcnow(),
            "preferences": {"email_notifications": True},
            "role": "Member"
        }
        self.db.users.insert_one(user_doc)
        return True, "Account created."

    def authenticate_user(self, email, password):
        user = self.db.users.find_one({"email": email})
        if user:
            try:
                if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                    return user
            except:
                if user['password'] == password: return user # Fallback
        return None
    
    def get_user(self, email):
        return self.db.users.find_one({"email": email})

    # --- WORKSPACES ---
    def get_user_workspaces(self, email):
        return list(self.db.workspaces.find({"members.email": email}))
    
    def create_workspace(self, name, owner_email):
        doc = {
            "name": name,
            "created_at": datetime.datetime.utcnow(),
            "owner": owner_email,
            "members": [{"email": owner_email, "role": "Owner"}],
            "custom_statuses": ["To Do", "In Progress", "Review", "Completed"]
        }
        return self.db.workspaces.insert_one(doc).inserted_id

    def add_workspace_member(self, ws_id, email, role="Employee"):
        # Check if user exists first
        if not self.db.users.find_one({"email": email}):
            return False, "User not found."
        
        self.db.workspaces.update_one(
            {"_id": ObjectId(ws_id)},
            {"$push": {"members": {"email": email, "role": role}}}
        )
        return True, "Added."

    def remove_workspace_member(self, ws_id, email):
        self.db.workspaces.update_one(
            {"_id": ObjectId(ws_id)},
            {"$pull": {"members": {"email": email}}}
        )

    def get_workspace_statuses(self, ws_id):
        ws = self.db.workspaces.find_one({"_id": ObjectId(ws_id)})
        return ws.get("custom_statuses", ["To Do", "In Progress", "Completed"]) if ws else []

    def update_workspace_statuses(self, ws_id, statuses):
        self.db.workspaces.update_one({"_id": ObjectId(ws_id)}, {"$set": {"custom_statuses": statuses}})

    # --- TASKS ---
    def create_task(self, ws_id, title, desc, due_date, assignee, status, priority, project_id, creator):
        task_id = self.db.tasks.insert_one({
            "workspace_id": ws_id,
            "title": title,
            "description": desc,
            "due_date": datetime.datetime.combine(due_date, datetime.time()) if due_date else None,
            "assignee": assignee,
            "status": status,
            "priority": priority,
            "project_id": project_id,
            "created_by": creator,
            "created_at": datetime.datetime.utcnow(),
            "subtasks": []
        }).inserted_id
        
        if assignee and assignee != creator:
            self.create_notification(assignee, "New Task", f"Assigned: {title}", "info")
        return task_id

    def get_tasks_with_urgency(self, query):
        tasks = list(self.db.tasks.find(query))
        now = datetime.datetime.utcnow()
        for t in tasks:
            t['urgency_color'] = "#4caf50" # Green
            if t.get('due_date'):
                diff = (t['due_date'] - now).total_seconds() / 3600
                if diff < 0: t['urgency_color'] = "#d32f2f" # Red (Overdue)
                elif diff < 48: t['urgency_color'] = "#f57c00" # Orange
        return tasks

    def update_task_status(self, task_id, status):
        self.db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": {"status": status}})

    # --- SUBTASKS ---
    def add_subtask(self, task_id, title):
        sub_id = str(ObjectId())
        self.db.tasks.update_one(
            {"_id": ObjectId(task_id)},
            {"$push": {"subtasks": {"id": sub_id, "title": title, "completed": False}}}
        )

    def toggle_subtask(self, task_id, subtask_id, completed):
        self.db.tasks.update_one(
            {"_id": ObjectId(task_id), "subtasks.id": subtask_id},
            {"$set": {"subtasks.$.completed": completed}}
        )

    # --- COMMENTS & CHAT ---
    def add_comment(self, entity_type, entity_id, user_email, text, **kwargs):
        user = self.get_user(user_email)
        comment = {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "user_email": user_email,
            "user_name": user['name'] if user else user_email,
            "text": text,
            "created_at": datetime.datetime.utcnow(),
            "reactions": {},
            "is_pinned": False,
            "is_deleted": False
        }
        comment.update(kwargs) # Parent comment ID, etc.
        self.db.comments.insert_one(comment)
        
        # Handle mentions
        self.handle_mentions(text, user['name'], f"{entity_type}:{entity_id}")

    def get_comments(self, entity_type, entity_id):
        return list(self.db.comments.find({
            "entity_type": entity_type, 
            "entity_id": entity_id
        }).sort("created_at", 1))

    def delete_comment(self, cid, user_email, is_admin_action=False):
        self.db.comments.update_one(
            {"_id": ObjectId(cid)}, 
            {"$set": {"is_deleted": True, "deleted_at": datetime.datetime.utcnow()}}
        )

    def toggle_reaction(self, cid, emoji, user_email):
        # Determine if we add or remove
        comment = self.db.comments.find_one({"_id": ObjectId(cid)})
        current = comment.get("reactions", {}).get(emoji, [])
        if user_email in current:
            self.db.comments.update_one({"_id": ObjectId(cid)}, {"$pull": {f"reactions.{emoji}": user_email}})
        else:
            self.db.comments.update_one({"_id": ObjectId(cid)}, {"$push": {f"reactions.{emoji}": user_email}})

    # --- TIME TRACKING ---
    def log_time_entry(self, task_id, user_email, seconds, description=""):
        self.db.time_entries.insert_one({
            "task_id": task_id,
            "user_email": user_email,
            "seconds": seconds,
            "description": description,
            "created_at": datetime.datetime.utcnow()
        })

    def get_task_time_entries(self, task_id):
        return list(self.db.time_entries.find({"task_id": task_id}).sort("created_at", -1))

    # --- EXTENSIONS ---
    def request_extension(self, task_id, requester, new_date, reason):
        req_id = self.db.extension_requests.insert_one({
            "task_id": task_id,
            "requester": requester,
            "new_date": str(new_date),
            "reason": reason,
            "status": "Pending",
            "created_at": datetime.datetime.utcnow()
        }).inserted_id
        
        # Find admins to notify
        task = self.db.tasks.find_one({"_id": ObjectId(task_id)})
        ws = self.db.workspaces.find_one({"_id": ObjectId(task['workspace_id'])})
        admins = [m['email'] for m in ws['members'] if m['role'] in ['Owner', 'Admin']]
        
        for admin in admins:
            self.create_notification(admin, "Extension Request", f"{requester} requested extension for {task['title']}", "warning")
        
        return admins

    # --- NOTIFICATIONS & UTILS ---
    def create_notification(self, email, title, msg, n_type="info", link=None):
        self.db.notifications.insert_one({
            "user_email": email, "title": title, "message": msg,
            "type": n_type, "link": link, "read": False,
            "created_at": datetime.datetime.utcnow()
        })

    def get_unread_notifications(self, email):
        return list(self.db.notifications.find({"user_email": email, "read": False}).sort("created_at", -1))
        
    def mark_notification_read(self, nid):
        self.db.notifications.update_one({"_id": ObjectId(nid)}, {"$set": {"read": True}})

    def handle_mentions(self, text, source_user, link):
        import re
        emails = re.findall(r"@([\w\.-]+@[\w\.-]+)", text)
        for email in emails:
            self.create_notification(email, "Mentioned", f"{source_user} mentioned you.", "mention", link)

    def get_user_stats(self, email):
        # Basic stats implementation
        total = self.db.tasks.count_documents({"assignee": email})
        completed = self.db.tasks.count_documents({"assignee": email, "status": "Completed"})
        rate = int((completed / total * 100) if total > 0 else 0)
        return {"assigned": total, "completed": completed, "rate": rate}
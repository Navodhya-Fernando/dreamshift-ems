import os
import datetime
import secrets
import re
from pymongo import MongoClient
from bson.objectid import ObjectId
import bcrypt
from src.mailer import send_task_assignment_email, send_password_reset_email, send_mention_email

def _load_streamlit_secrets_to_env():
    try:
        import streamlit as st
    except Exception:
        return

    try:
        for key, value in st.secrets.items():
            if isinstance(value, (dict, list)):
                continue
            os.environ.setdefault(str(key), str(value))
    except Exception:
        return

class DreamShiftDB:
    def __init__(self):
        _load_streamlit_secrets_to_env()
        MONGO_URI = os.getenv("MONGODB_URI")
        DB_NAME = os.getenv("DB_NAME", "dreamshift")
        
        if not MONGO_URI:
            raise ValueError("MONGODB_URI not found in .env file.")
            
        try:
            self.client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            # Trigger a connection check
            self.client.admin.command('ping')
            self.db = self.client[DB_NAME]
            self.ObjectId = ObjectId
        except Exception as e:
            print(f"MongoDB Connection Failed: {e}")
            raise e

    # ==========================================
    # AUTHENTICATION & USERS
    # ==========================================

    def create_user(self, email, password, name):
        """Creates a new user with hashed password."""
        if self.db.users.find_one({"email": email}):
            return False, "Email already registered."
        
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user_doc = {
            "email": email,
            "password": hashed,
            "name": name,
            "created_at": datetime.datetime.utcnow(),
            "role": "Member",
            "preferences": {"email_notifications": True}
        }
        self.db.users.insert_one(user_doc)
        return True, "Account created."

    def authenticate_user(self, email, password):
        """Checks email and password against database."""
        user = self.db.users.find_one({"email": email})
        if user:
            try:
                if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                    return user
            except:
                # Fallback for legacy plain text passwords (if any)
                if user['password'] == password: return user
        return None
    
    def get_user(self, email):
        return self.db.users.find_one({"email": email})

    def get_user_stats(self, email):
        """Returns basic productivity stats for the user."""
        total = self.db.tasks.count_documents({"assignee": email})
        completed = self.db.tasks.count_documents({"assignee": email, "status": "Completed"})
        rate = int((completed / total * 100) if total > 0 else 0)
        return {"assigned": total, "completed": completed, "rate": rate}

    # ==========================================
    # 📧 PASSWORD RESET (Email Trigger)
    # ==========================================

    def create_password_reset_token(self, email):
        """Generates a token and sends an EMAIL."""
        user = self.get_user(email)
        if not user:
            return False, "User not found"
        
        token = secrets.token_urlsafe(32)
        expiration = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        
        self.db.password_resets.insert_one({
            "email": email,
            "token": token,
            "expires_at": expiration,
            "used": False
        })
        
        app_base_url = os.getenv("APP_BASE_URL", "http://localhost:8501").rstrip("/")
        reset_link = f"{app_base_url}/password-reset?token={token}" 
        
        # 📨 TRIGGER EMAIL
        email_ok = send_password_reset_email(email, reset_link)
        if not email_ok:
            return False, "Unable to send reset email."
        return True, "Reset link sent to email."

    def reset_password_with_token(self, token, new_password):
        """Verifies token and updates password."""
        record = self.db.password_resets.find_one({"token": token, "used": False})
        if not record:
            return False, "Invalid or used token."
        
        if record['expires_at'] < datetime.datetime.utcnow():
            return False, "Token expired."
            
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        self.db.users.update_one({"email": record['email']}, {"$set": {"password": hashed}})
        self.db.password_resets.update_one({"_id": record['_id']}, {"$set": {"used": True}})
        
        return True, "Password updated successfully."

    # ==========================================
    # 🏢 WORKSPACES
    # ==========================================

    def get_user_workspaces(self, email):
        """Return ALL workspaces - no restrictions."""
        return list(self.db.workspaces.find({}))

    def get_workspace_members(self, workspace_id):
        """Return workspace members enriched with names (fallback to email username)."""
        ws = self.db.workspaces.find_one({"_id": ObjectId(workspace_id)})
        members = ws.get('members', []) if ws else []
        emails = [m.get('email') for m in members if m.get('email')]
        user_map = {u['email']: u for u in self.db.users.find({"email": {"$in": emails}})} if emails else {}

        enriched = []
        for m in members:
            email = m.get('email')
            role = m.get('role')
            user = user_map.get(email)
            name = (user.get('name') if user else None) or (email.split('@')[0].replace('.', ' ').title() if email else 'Member')
            enriched.append({"email": email, "role": role, "name": name})
        return enriched
    
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

    # ==========================================
    # TASKS (Email Trigger)
    # ==========================================

    def create_task(self, ws_id, title, desc, due_date, assignee, status, priority, project_id, creator, start_date=None):
        task_id = self.db.tasks.insert_one({
            "workspace_id": ws_id,
            "title": title,
            "description": desc,
            "start_date": datetime.datetime.combine(start_date, datetime.time()) if start_date else None,
            "due_date": datetime.datetime.combine(due_date, datetime.time()) if due_date else None,
            "end_date": None,
            "assignee": assignee,
            "status": status,
            "priority": priority,
            "project_id": project_id,
            "created_by": creator,
            "created_at": datetime.datetime.utcnow(),
            "subtasks": [],
            "status_history": [
                {
                    "from": None,
                    "to": status,
                    "by": creator,
                    "at": datetime.datetime.utcnow()
                }
            ]
        }).inserted_id
        
        # 📨 TRIGGER EMAIL + INBOX NOTIFICATION
        if assignee and assignee != creator:
            # 1. Email (respect user preferences)
            assignee_user = self.get_user(assignee)
            allow_email = True
            if assignee_user:
                allow_email = assignee_user.get("preferences", {}).get("email_notifications", True)
            if allow_email:
                send_task_assignment_email(assignee, title, creator, due_date)
            # 2. Inbox
            self.create_notification(assignee, "New Task", f"Assigned: {title}", "info")
            
        return task_id

    def get_tasks_with_urgency(self, query):
        """Fetches tasks and calculates urgency color locally."""
        tasks = list(self.db.tasks.find(query))
        now = datetime.datetime.utcnow()
        for t in tasks:
            t['urgency_color'] = "#4caf50" # Green
            if t.get('due_date'):
                diff = (t['due_date'] - now).total_seconds() / 3600
                if diff < 0: t['urgency_color'] = "#d32f2f" # Red (Overdue)
                elif diff < 48: t['urgency_color'] = "#f57c00" # Orange
        return tasks

    def update_task_status(self, task_id, status, user_email=None):
        task = self.db.tasks.find_one({"_id": ObjectId(task_id)})
        if not task:
            return

        updates = {"status": status}
        if status == "Completed" and not task.get("end_date"):
            updates["end_date"] = datetime.datetime.utcnow()

        self.db.tasks.update_one(
            {"_id": ObjectId(task_id)},
            {
                "$set": updates,
                "$push": {
                    "status_history": {
                        "from": task.get("status"),
                        "to": status,
                        "by": user_email,
                        "at": datetime.datetime.utcnow()
                    }
                }
            }
        )

    def update_task_dates(self, task_id, start_date=None, end_date=None):
        updates = {}
        if start_date is not None:
            updates["start_date"] = datetime.datetime.combine(start_date, datetime.time()) if start_date else None
        if end_date is not None:
            updates["end_date"] = datetime.datetime.combine(end_date, datetime.time()) if end_date else None
        if updates:
            self.db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": updates})

    # ==========================================
    # 🧩 TASK TEMPLATES
    # ==========================================

    def get_task_templates(self, workspace_id):
        return list(self.db.task_templates.find({"workspace_id": workspace_id}).sort("created_at", -1))

    def create_task_template(self, workspace_id, name, tasks, created_by):
        return self.db.task_templates.insert_one({
            "workspace_id": workspace_id,
            "name": name,
            "tasks": tasks,
            "created_by": created_by,
            "created_at": datetime.datetime.utcnow()
        }).inserted_id

    def delete_task_template(self, template_id):
        self.db.task_templates.delete_one({"_id": ObjectId(template_id)})

    # ==========================================
    # ☑️ SUBTASKS
    # ==========================================

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

    # ==========================================
    # 💬 COMMENTS (Inbox Only)
    # ==========================================

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
            "is_deleted": False
        }
        comment.update(kwargs)
        self.db.comments.insert_one(comment)
        
        # 🔔 INBOX + EMAIL: Handle Mentions
        source_display = user['name'] if user and user.get('name') else user_email
        workspace_id = kwargs.get('workspace_id')
        self.handle_mentions(
            text=text,
            source_user=source_display,
            source_email=user_email,
            entity_type=entity_type,
            entity_id=entity_id,
            workspace_id=workspace_id,
        )

    def get_comments(self, entity_type, entity_id):
        return list(self.db.comments.find({
            "entity_type": entity_type, 
            "entity_id": entity_id,
            "is_deleted": False
        }).sort("created_at", 1))

    def delete_comment(self, cid):
        self.db.comments.update_one(
            {"_id": ObjectId(cid)}, 
            {"$set": {"is_deleted": True}}
        )

    def toggle_reaction(self, cid, emoji, user_email):
        comment = self.db.comments.find_one({"_id": ObjectId(cid)})
        current = comment.get("reactions", {}).get(emoji, [])
        if user_email in current:
            self.db.comments.update_one({"_id": ObjectId(cid)}, {"$pull": {f"reactions.{emoji}": user_email}})
        else:
            self.db.comments.update_one({"_id": ObjectId(cid)}, {"$push": {f"reactions.{emoji}": user_email}})

    # ==========================================
    # ⏱️ TIME TRACKING
    # ==========================================

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

    # ==========================================
    # 📅 EXTENSIONS (Inbox Only)
    # ==========================================

    def request_extension(self, task_id, requester, new_date, reason):
        """Creates an extension request and notifies admins via INBOX only."""
        req_id = self.db.extension_requests.insert_one({
            "task_id": task_id,
            "requester": requester,
            "new_date": str(new_date),
            "reason": reason,
            "status": "Pending",
            "created_at": datetime.datetime.utcnow()
        }).inserted_id
        
        # Find admins
        task = self.db.tasks.find_one({"_id": ObjectId(task_id)})
        if not task: return
        ws = self.db.workspaces.find_one({"_id": ObjectId(task['workspace_id'])})
        admins = [m['email'] for m in ws['members'] if m['role'] in ['Owner', 'Admin']]
        
        # 🔔 INBOX ONLY: Notify Admins
        for admin in admins:
            self.create_notification(admin, "Extension Request", f"{requester} requested extension for {task['title']}", "warning")
        
        return admins

    # ==========================================
    # 🔔 INTERNAL NOTIFICATIONS & UTILS
    # ==========================================

    def create_notification(self, email, title, msg, n_type="info", link=None):
        """Creates an internal DB notification. Does NOT send email."""
        self.db.notifications.insert_one({
            "user_email": email, "title": title, "message": msg,
            "type": n_type, "link": link, "read": False,
            "created_at": datetime.datetime.utcnow()
        })

    def get_unread_notifications(self, email):
        return list(self.db.notifications.find({"user_email": email, "read": False}).sort("created_at", -1))
        
    def mark_notification_read(self, nid):
        self.db.notifications.update_one({"_id": ObjectId(nid)}, {"$set": {"read": True}})

    def handle_mentions(self, text, source_user, source_email, entity_type, entity_id, workspace_id=None):
        """Parses @mentions (name or email), creates Inbox notifications, and sends email."""
        targets = {}

        name_lookup = {}
        if workspace_id:
            for m in self.get_workspace_members(workspace_id):
                name = (m.get('name') or '').strip()
                email = m.get('email')
                if name and email and name.lower() not in name_lookup:
                    name_lookup[name.lower()] = email

        pattern = re.compile(r"@([A-Za-z][A-Za-z0-9 .'-]{0,48}|[\w\.\-\+]+@[\w\.-]+)(?=$|\s|[.,;:!?])")
        for mention in pattern.findall(text or ""):
            if '@' in mention:
                targets[mention.lower()] = mention
            else:
                email = name_lookup.get(mention.lower())
                if email:
                    targets[email.lower()] = email

        app_base_url = os.getenv("APP_BASE_URL", "http://localhost:8501").rstrip("/")
        entity_label = "item"
        link = app_base_url

        if entity_type == "task":
            task = self.db.tasks.find_one({"_id": ObjectId(entity_id)})
            if task:
                entity_label = f"task: {task.get('title', 'Task')}"
                link = f"{app_base_url}/tasks"
        elif entity_type == "project":
            project = self.db.projects.find_one({"_id": ObjectId(entity_id)})
            if project:
                entity_label = f"project: {project.get('name', 'Project')}"
                link = f"{app_base_url}/projects"

        for email in targets.values():
            if source_email and email.lower() == source_email.lower():
                continue

            self.create_notification(email, "Mentioned", f"{source_user} mentioned you.", "mention", link)

            user = self.get_user(email)
            allow_email = True
            if user:
                allow_email = user.get("preferences", {}).get("email_notifications", True)
            if allow_email:
                send_mention_email(email, source_user, entity_label, text, link)
import os
import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
from bson.objectid import ObjectId
import hashlib
import streamlit as st

# Load environment variables (local development)
load_dotenv()

class DreamShiftDB:
    def __init__(self):
        """Initializes the connection to MongoDB using .env or Streamlit secrets."""
        # Try Streamlit secrets first (cloud deployment), then fall back to .env (local)
        try:
            mongodb_uri = st.secrets["MONGODB_URI"]
            db_name = st.secrets.get("DB_NAME", "dreamshift")
        except:
            mongodb_uri = os.getenv("MONGODB_URI")
            db_name = os.getenv("DB_NAME", "dreamshift")
        
        if not mongodb_uri:
            raise ValueError("MONGODB_URI not found in secrets or .env file")
        
        # Cloud-optimized connection with timeout and retry settings
        self.client = MongoClient(
            mongodb_uri,
            serverSelectionTimeoutMS=10000,  # 10 second timeout
            connectTimeoutMS=10000,
            socketTimeoutMS=10000,
            retryWrites=True,
            retryReads=True,
            maxPoolSize=50,
            minPoolSize=10
        )
        
        self.db = self.client[db_name]
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        """Create indexes for better query performance."""
        try:
            # Test connection first
            self.client.admin.command('ping')
            
            # Create indexes only if connection is successful
            self.db.tasks.create_index([("assignee", 1), ("status", 1)], background=True)
            self.db.tasks.create_index([("workspace_id", 1), ("due_date", 1)], background=True)
            self.db.notifications.create_index([("user_email", 1), ("read", 1)], background=True)
            self.db.time_entries.create_index([("task_id", 1), ("user", 1)], background=True)
            self.db.task_templates.create_index([("workspace_id", 1), ("is_active", 1)], background=True)
        except Exception as e:
            # Log error but don't crash - indexes might already exist
            print(f"Index creation warning: {e}")

    # ==========================================
    # 1. USER & AUTHENTICATION
    # ==========================================
    def create_user(self, email, password, name, role="Employee"):
        """Create a new user account."""
        hashed_pw = hashlib.sha256(password.encode()).hexdigest()
        user = {
            "email": email,
            "password": hashed_pw,
            "name": name,
            "role": role,
            "profile_pic": None,
            "contract_expiry": None,
            "created_at": datetime.datetime.utcnow(),
            "preferences": {
                "theme": "light",
                "email_notifications": True,
                "notification_frequency": "immediate"
            }
        }
        return self.db.users.insert_one(user)
    
    def authenticate_user(self, email, password):
        """Authenticate user login."""
        hashed_pw = hashlib.sha256(password.encode()).hexdigest()
        user = self.db.users.find_one({"email": email, "password": hashed_pw})
        return user
    
    def get_user(self, email):
        """Get user details."""
        return self.db.users.find_one({"email": email}, {"password": 0})
    
    def update_user_profile(self, email, updates):
        """Update user profile information."""
        return self.db.users.update_one({"email": email}, {"$set": updates})
    
    def get_user_by_email(self, email: str):
        """Get user by email (alias for get_user)."""
        return self.get_user(email)
    
    def is_email_taken(self, email: str) -> bool:
        """Check if email is already registered."""
        return self.db.users.find_one({"email": email}) is not None
    
    def update_user_profile_fields(self, user_email: str, updates: dict):
        """Update multiple user profile fields at once."""
        set_doc = {}
        for k, v in updates.items():
            set_doc[k] = v
        return self.db.users.update_one({"email": user_email}, {"$set": set_doc})
    
    def hash_password(self, password: str) -> str:
        """Hash a password using SHA256."""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def verify_password(self, password: str, password_hash: str) -> bool:
        """Verify a password against its hash."""
        return self.hash_password(password) == password_hash
    
    def verify_user_password(self, email: str, password: str) -> bool:
        """Verify user's password."""
        user = self.db.users.find_one({"email": email})
        if not user:
            return False
        return self.verify_password(password, user.get("password", ""))
    
    def update_password(self, email: str, new_password: str):
        """Update user password."""
        new_hash = self.hash_password(new_password)
        return self.db.users.update_one(
            {"email": email},
            {"$set": {
                "password": new_hash,
                "security.password_updated_at": datetime.datetime.utcnow()
            }}
        )
    
    def create_email_change_token(self, current_email: str, new_email: str, ttl_minutes: int = 30) -> str:
        """Create a token for email change verification."""
        import secrets
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=ttl_minutes)
        
        self.db.users.update_one(
            {"email": current_email},
            {"$set": {
                "security.email_change.pending_email": new_email,
                "security.email_change.token_hash": token_hash,
                "security.email_change.expires_at": expires_at
            }}
        )
        return token
    
    def confirm_email_change(self, token: str) -> bool:
        """Confirm email change with verification token."""
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        now = datetime.datetime.utcnow()
        
        user = self.db.users.find_one({
            "security.email_change.token_hash": token_hash,
            "security.email_change.expires_at": {"$gt": now}
        })
        
        if not user:
            return False
        
        pending_email = user.get("security", {}).get("email_change", {}).get("pending_email")
        if not pending_email:
            return False
        
        # Ensure the pending email is still free
        if self.is_email_taken(pending_email):
            return False
        
        old_email = user["email"]
        
        # Update user email and clear pending data
        self.db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "email": pending_email,
                "security.email_change.pending_email": None,
                "security.email_change.token_hash": None,
                "security.email_change.expires_at": None
            }}
        )
        
        # Update workspace member references
        self.db.workspaces.update_many(
            {"members.email": old_email},
            {"$set": {"members.$[m].email": pending_email}},
            array_filters=[{"m.email": old_email}]
        )
        
        # Update tasks assignee
        self.db.tasks.update_many(
            {"assignee": old_email},
            {"$set": {"assignee": pending_email}}
        )
        
        return True

    # ==========================================
    # 2. WORKSPACE & ROLE MANAGEMENT
    # ==========================================
    def create_workspace(self, name, owner_email):
        workspace = {
            "name": name,
            "owner": owner_email,
            "members": [{"email": owner_email, "role": "Owner"}],
            "created_at": datetime.datetime.utcnow()
        }
        return self.db.workspaces.insert_one(workspace)

    def get_user_workspaces(self, email):
        return list(self.db.workspaces.find({"members.email": email}))

    def get_user_role(self, workspace_id, email):
        ws = self.db.workspaces.find_one(
            {"_id": ObjectId(workspace_id), "members.email": email},
            {"members.$": 1}
        )
        return ws['members'][0]['role'] if ws else "Employee"

    def add_member(self, ws_id, email, role="Employee"):
        return self.db.workspaces.update_one(
            {"_id": ObjectId(ws_id)},
            {"$addToSet": {"members": {"email": email, "role": role}}}
        )
    
    def remove_member(self, ws_id, email):
        """Remove member from workspace."""
        return self.db.workspaces.update_one(
            {"_id": ObjectId(ws_id)},
            {"$pull": {"members": {"email": email}}}
        )
    
    def update_member_role(self, ws_id, email, new_role):
        """Update member role in workspace."""
        self.db.workspaces.update_one(
            {"_id": ObjectId(ws_id), "members.email": email},
            {"$set": {"members.$.role": new_role}}
        )
    
    def get_workspace_members(self, ws_id):
        """Get all members of a workspace."""
        ws = self.db.workspaces.find_one({"_id": ObjectId(ws_id)})
        return ws.get('members', []) if ws else []
    
    def get_workspace_member(self, workspace_id, email):
        """Get a specific member from workspace by email."""
        ws = self.db.workspaces.find_one({"_id": ObjectId(workspace_id)})
        if not ws:
            return None
        members = ws.get('members', [])
        for member in members:
            if member.get('email') == email:
                return member
        return None
    
    def get_workspace(self, ws_id):
        """Get workspace by ID."""
        return self.db.workspaces.find_one({"_id": ObjectId(ws_id)})
    
    def update_workspace(self, ws_id, updates):
        """Update workspace details."""
        return self.db.workspaces.update_one({"_id": ObjectId(ws_id)}, {"$set": updates})
    
    def delete_workspace(self, ws_id):
        """Delete a workspace and all its projects and tasks."""
        # Delete all tasks in the workspace
        self.db.tasks.delete_many({"workspace_id": str(ws_id)})
        # Delete all projects in the workspace
        self.db.projects.delete_many({"workspace_id": str(ws_id)})
        # Delete the workspace
        return self.db.workspaces.delete_one({"_id": ObjectId(ws_id)})
    
    def add_workspace_member(self, ws_id, email, role="Employee"):
        """Add a member to workspace."""
        return self.db.workspaces.update_one(
            {"_id": ObjectId(ws_id)},
            {"$addToSet": {"members": {"email": email, "role": role}}}
        )
    
    def remove_workspace_member(self, ws_id, email):
        """Remove a member from workspace."""
        return self.db.workspaces.update_one(
            {"_id": ObjectId(ws_id)},
            {"$pull": {"members": {"email": email}}}
        )

    # ==========================================
    # 3. PROJECT MANAGEMENT
    # ==========================================
    def create_project(self, workspace_id, name, description, deadline, status="Active", created_by=None, service=None, template_id=None, template_name=None):
        """Create a new project with optional template support."""
        project = {
            "workspace_id": str(workspace_id),
            "name": name,
            "description": description,
            "service": service,
            "deadline": deadline if isinstance(deadline, datetime.datetime) else datetime.datetime.combine(deadline, datetime.time.min),
            "status": status,
            "created_by": created_by,
            "template_id": template_id,
            "template_name": template_name,
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow()
        }
        result = self.db.projects.insert_one(project)
        return str(result.inserted_id)

    def get_projects(self, workspace_id):
        return list(self.db.projects.find({"workspace_id": str(workspace_id)}))
    
    def get_project(self, project_id):
        """Get single project details."""
        return self.db.projects.find_one({"_id": ObjectId(project_id)})
    
    def update_project(self, project_id, updates):
        """Update project details."""
        return self.db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": updates})
    
    def get_project_progress(self, project_id):
        """Calculate project progress based on tasks."""
        tasks = list(self.db.tasks.find({"project_id": str(project_id)}))
        if not tasks:
            return 0
        completed = sum(1 for t in tasks if t.get('status') == 'Completed')
        return int((completed / len(tasks)) * 100)

    # ==========================================
    # 4. TASK MANAGEMENT & URGENCY
    # ==========================================
    def create_task(self, project_id, ws_id, title, desc, assignee, due_date, priority, is_recurring=False, recurrence_pattern=None):
        task = {
            "project_id": str(project_id),
            "workspace_id": str(ws_id),
            "title": title,
            "description": desc,
            "assignee": assignee,
            "due_date": due_date if isinstance(due_date, datetime.datetime) else datetime.datetime.combine(due_date, datetime.time.min),
            "priority": priority,
            "status": "To Do",
            "subtasks": [],
            "completion_pct": 0,
            "is_recurring": is_recurring,
            "recurrence_pattern": recurrence_pattern,
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow()
        }
        result = self.db.tasks.insert_one(task)
        
        # Create notification for assignee
        self.create_notification(
            assignee,
            "task_assigned",
            f"You were assigned to task: {title}",
            {"task_id": str(result.inserted_id)}
        )
        return result

    def get_tasks_with_urgency(self, query):
        """ClickUp-style dynamic color coding (Green/Yellow/Red)."""
        tasks = list(self.db.tasks.find(query))
        now = datetime.datetime.utcnow()
        for task in tasks:
            start = task.get('created_at', now - datetime.timedelta(days=14))
            due = task.get('due_date')
            if due:
                total = (due - start).total_seconds()
                elapsed = (now - start).total_seconds()
                percent = (elapsed / total * 100) if total > 0 else 100
                if percent < 50: 
                    task['urgency_color'] = "#28A745" # Green
                    task['urgency_label'] = "On Track"
                elif percent < 80: 
                    task['urgency_color'] = "#FFC107" # Yellow
                    task['urgency_label'] = "Due Soon"
                else: 
                    task['urgency_color'] = "#DC3545" # Red
                    task['urgency_label'] = "Urgent"
            else:
                task['urgency_color'] = "#6c757d"
                task['urgency_label'] = "No Deadline"
            
            # Add project name
            project = self.db.projects.find_one({"_id": ObjectId(task['project_id'])})
            task['project_name'] = project['name'] if project else "Unknown Project"
        
        tasks.sort(key=lambda x: x.get('due_date', datetime.datetime.max))
        return tasks
    
    def get_task(self, task_id):
        """Get single task details."""
        return self.db.tasks.find_one({"_id": ObjectId(task_id)})
    
    def get_tasks_for_project(self, project_id):
        """Get all tasks for a specific project."""
        return list(self.db.tasks.find({"project_id": str(project_id)}).sort("due_date", 1))
    
    def update_task(self, task_id, updates):
        """Update task details."""
        updates['updated_at'] = datetime.datetime.utcnow()
        return self.db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": updates})
    
    def update_task_status(self, task_id, new_status):
        """Update task status and trigger recurring task creation if needed."""
        task = self.get_task(task_id)
        self.update_task(task_id, {"status": new_status})
        
        # If completed and recurring, create next occurrence
        if new_status == "Completed" and task.get('is_recurring'):
            self._create_recurring_task(task)
    
    def update_task_priority(self, task_id: str, priority: str):
        """Update task priority."""
        return self.db.tasks.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": {"priority": priority, "updated_at": datetime.datetime.utcnow()}}
        )
    
    def _create_recurring_task(self, task):
        """Create next occurrence of recurring task."""
        pattern = task.get('recurrence_pattern', {})
        if pattern.get('type') == 'daily':
            next_due = task['due_date'] + datetime.timedelta(days=pattern.get('interval', 1))
        elif pattern.get('type') == 'weekly':
            next_due = task['due_date'] + datetime.timedelta(weeks=pattern.get('interval', 1))
        elif pattern.get('type') == 'monthly':
            next_due = task['due_date'] + datetime.timedelta(days=30 * pattern.get('interval', 1))
        else:
            return
        
        new_task = {
            "project_id": task['project_id'],
            "workspace_id": task['workspace_id'],
            "title": task['title'],
            "description": task['description'],
            "assignee": task['assignee'],
            "due_date": next_due,
            "priority": task['priority'],
            "status": "To Do",
            "subtasks": [],
            "completion_pct": 0,
            "is_recurring": True,
            "recurrence_pattern": pattern,
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow()
        }
        result = self.db.tasks.insert_one(new_task)
        
        # Notify assignee
        self.create_notification(
            task['assignee'],
            "task_assigned",
            f"Recurring task is due: {task['title']}",
            {"task_id": str(result.inserted_id)}
        )
    
    def get_extension_requests(self, workspace_id, status=None):
        """Get contract extension requests for a workspace."""
        query = {"workspace_id": str(workspace_id)}
        if status:
            query["status"] = status
        return list(self.db.extension_requests.find(query).sort("created_at", -1))
    
    def approve_extension_request(self, request_id):
        """Approve an extension request."""
        return self.db.extension_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": "Approved", "updated_at": datetime.datetime.utcnow()}}
        )
    
    def reject_extension_request(self, request_id):
        """Reject an extension request."""
        return self.db.extension_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": "Rejected", "updated_at": datetime.datetime.utcnow()}}
        )

    # ==========================================
    # 5. SUBTASKS
    # ==========================================
    def add_subtask(self, task_id, title, due_date=None):
        """Add a subtask to a task."""
        subtask = {
            "id": str(ObjectId()),
            "title": title,
            "completed": False,
            "due_date": due_date,
            "created_at": datetime.datetime.utcnow()
        }
        self.db.tasks.update_one(
            {"_id": ObjectId(task_id)},
            {"$push": {"subtasks": subtask}}
        )
        self._update_task_completion(task_id)
    
    def toggle_subtask(self, task_id, subtask_id):
        """Toggle subtask completion status."""
        task = self.get_task(task_id)
        for subtask in task.get('subtasks', []):
            if subtask['id'] == subtask_id:
                subtask['completed'] = not subtask['completed']
                break
        
        self.db.tasks.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": {"subtasks": task['subtasks']}}
        )
        self._update_task_completion(task_id)
    
    def _update_task_completion(self, task_id):
        """Update task completion percentage based on subtasks."""
        task = self.get_task(task_id)
        subtasks = task.get('subtasks', [])
        if not subtasks:
            completion_pct = 0
        else:
            completed = sum(1 for s in subtasks if s.get('completed'))
            completion_pct = int((completed / len(subtasks)) * 100)
        
        self.update_task(task_id, {"completion_pct": completion_pct})

    # ==========================================
    # ==========================================
    # 6. COMMENTS
    # ==========================================
    def get_display_name(self, email: str) -> str:
        """Get display name for user, fallback to email."""
        u = self.get_user(email)
        if not u:
            return email
        return u.get("name") or email
    
    def get_workspace_member_emails(self, workspace_id: str):
        """Get list of member emails in workspace."""
        ws = self.get_workspace(workspace_id)
        if not ws:
            return []
        members = ws.get("members", []) or []
        return [m.get("email") for m in members if m.get("email")]
    
    def get_workspace_members_for_mentions(self, workspace_id: str):
        """Get workspace members with name/email for mention autocomplete."""
        emails = self.get_workspace_member_emails(workspace_id)
        out = []
        for e in emails:
            u = self.get_user(e)
            if u:
                out.append({"email": e, "name": u.get("name") or e})
            else:
                out.append({"email": e, "name": e})
        # Sort by name
        out.sort(key=lambda x: (x["name"] or "").lower())
        return out
    
    def add_comment(self, entity_type, entity_id, user_email, text, workspace_id=None, project_id=None, task_id=None, parent_comment_id=None):
        """Add comment to task or project with reactions, pin support, and threading."""
        comment = {
            "entity_type": entity_type,  # 'task' or 'project'
            "entity_id": str(entity_id),
            "workspace_id": str(workspace_id) if workspace_id else None,
            "project_id": str(project_id) if project_id else None,
            "task_id": str(task_id) if task_id else None,
            
            "user_email": user_email,
            "user_name": self.get_display_name(user_email),
            "text": text.strip(),
            "created_at": datetime.datetime.utcnow(),
            
            "is_pinned": False,
            "pinned_at": None,
            "pinned_by": None,
            
            "reactions": {},
            
            # Threading and edit/delete
            "parent_comment_id": ObjectId(parent_comment_id) if parent_comment_id else None,
            "edited_at": None,
            "is_deleted": False,
            "deleted_at": None,
        }
        result = self.db.comments.insert_one(comment)
        
        # Check for @mentions and create notifications
        words = text.split()
        for word in words:
            if word.startswith('@'):
                mentioned_email = word[1:]
                if self.get_user(mentioned_email):  # Only notify if user exists
                    self.create_notification(
                        mentioned_email,
                        "mentioned",
                        f"{self.get_display_name(user_email)} mentioned you in a comment",
                        {"comment_id": str(result.inserted_id), "entity_type": entity_type, "entity_id": str(entity_id)}
                    )
        
        return result.inserted_id
    
    def get_comments(self, entity_type, entity_id, pinned_only: bool = False):
        """Get all comments for a task or project. Pinned first, then by date."""
        query = {
            "entity_type": entity_type,
            "entity_id": str(entity_id)
        }
        if pinned_only:
            query["is_pinned"] = True
        
        comments = list(self.db.comments.find(query).sort([("is_pinned", -1), ("created_at", -1)]))
        
        return comments
    
    def toggle_pin_comment(self, comment_id: str, actor_email: str, is_pinned: bool):
        """Pin or unpin a comment."""
        update = {
            "is_pinned": bool(is_pinned),
            "pinned_at": datetime.datetime.utcnow() if is_pinned else None,
            "pinned_by": actor_email if is_pinned else None
        }
        return self.db.comments.update_one({"_id": ObjectId(comment_id)}, {"$set": update})
    
    def toggle_reaction(self, comment_id: str, emoji: str, user_email: str):
        """Toggle reaction on a comment."""
        c = self.db.comments.find_one({"_id": ObjectId(comment_id)})
        if not c:
            return False
        
        reactions = c.get("reactions", {}) or {}
        users = reactions.get(emoji, []) or []
        
        if user_email in users:
            users = [u for u in users if u != user_email]
        else:
            users.append(user_email)
        
        if users:
            reactions[emoji] = users
        else:
            # Remove empty reaction bucket
            if emoji in reactions:
                del reactions[emoji]
        
        self.db.comments.update_one({"_id": ObjectId(comment_id)}, {"$set": {"reactions": reactions}})
        return True
    
    def edit_comment(self, comment_id: str, actor_email: str, new_text: str):
        """Edit a comment (author only)."""
        c = self.db.comments.find_one({"_id": ObjectId(comment_id)})
        if not c:
            return False
        if c.get("user_email") != actor_email:
            return False
        if c.get("is_deleted"):
            return False
        
        return bool(
            self.db.comments.update_one(
                {"_id": ObjectId(comment_id)},
                {"$set": {"text": new_text.strip(), "edited_at": datetime.datetime.utcnow()}}
            ).modified_count
        )
    
    def delete_comment(self, comment_id: str, actor_email: str):
        """Soft delete a comment (author only)."""
        c = self.db.comments.find_one({"_id": ObjectId(comment_id)})
        if not c:
            return False
        if c.get("user_email") != actor_email:
            return False
        if c.get("is_deleted"):
            return True
        
        return bool(
            self.db.comments.update_one(
                {"_id": ObjectId(comment_id)},
                {"$set": {"is_deleted": True, "deleted_at": datetime.datetime.utcnow()}}
            ).modified_count
        )

    # ==========================================
    # 7. TIME TRACKING (CLOCKIFY STYLE)
    # ==========================================
    def log_time_entry(self, task_id, email, seconds, description=""):
        entry = {
            "task_id": str(task_id),
            "user": email,
            "duration": seconds,
            "description": description,
            "timestamp": datetime.datetime.utcnow()
        }
        return self.db.time_entries.insert_one(entry)
    
    def get_task_time_entries(self, task_id):
        """Get all time entries for a task."""
        return list(self.db.time_entries.find({"task_id": str(task_id)}).sort("timestamp", -1))
    
    def get_user_time_entries(self, email, start_date=None, end_date=None):
        """Get time entries for a user within date range."""
        query = {"user": email}
        if start_date or end_date:
            query["timestamp"] = {}
            if start_date:
                query["timestamp"]["$gte"] = start_date
            if end_date:
                query["timestamp"]["$lte"] = end_date
        
        return list(self.db.time_entries.find(query).sort("timestamp", -1))
    
    def get_total_time_for_task(self, task_id):
        """Get total time logged for a task."""
        entries = self.get_task_time_entries(task_id)
        total = sum(e['duration'] for e in entries)
        return total
    
    def get_total_time_for_user(self, email, start_date=None, end_date=None):
        """Get total time logged by user."""
        entries = self.get_user_time_entries(email, start_date, end_date)
        total = sum(e['duration'] for e in entries)
        return total

    # ==========================================
    # 8. NOTIFICATIONS
    # ==========================================
    def create_notification(self, user_email, notification_type, message, metadata=None):
        """Create a notification for a user."""
        notification = {
            "user_email": user_email,
            "type": notification_type,
            "message": message,
            "metadata": metadata or {},
            "read": False,
            "created_at": datetime.datetime.utcnow()
        }
        return self.db.notifications.insert_one(notification)
    
    def get_user_notifications(self, email, unread_only=False):
        """Get notifications for a user."""
        query = {"user_email": email}
        if unread_only:
            query["read"] = False
        return list(self.db.notifications.find(query).sort("created_at", -1).limit(50))
    
    def mark_notification_read(self, notification_id):
        """Mark notification as read."""
        return self.db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True}}
        )
    
    def mark_all_notifications_read(self, email):
        """Mark all notifications as read for a user."""
        return self.db.notifications.update_many(
            {"user_email": email, "read": False},
            {"$set": {"read": True}}
        )

    # ==========================================
    # 9. DEADLINE EXTENSION REQUESTS
    # ==========================================
    def create_extension_request(self, task_id, requester_email, new_deadline, reason):
        """Create a deadline extension request."""
        request = {
            "task_id": str(task_id),
            "requester_email": requester_email,
            "new_deadline": new_deadline,
            "reason": reason,
            "status": "Pending",
            "created_at": datetime.datetime.utcnow()
        }
        result = self.db.extension_requests.insert_one(request)
        
        # Notify admins
        task = self.get_task(task_id)
        ws_members = self.get_workspace_members(task['workspace_id'])
        for member in ws_members:
            if member['role'] in ['Owner', 'Workspace Admin']:
                self.create_notification(
                    member['email'],
                    "extension_request",
                    f"{requester_email} requested deadline extension for task",
                    {"request_id": str(result.inserted_id), "task_id": str(task_id)}
                )
        
        return result
    
    def get_pending_extension_requests(self, workspace_id):
        """Get pending extension requests for a workspace."""
        tasks = list(self.db.tasks.find({"workspace_id": str(workspace_id)}))
        task_ids = [str(t['_id']) for t in tasks]
        return list(self.db.extension_requests.find({
            "task_id": {"$in": task_ids},
            "status": "Pending"
        }))
    
    def approve_extension_request(self, request_id):
        """Approve extension request and update task deadline."""
        request = self.db.extension_requests.find_one({"_id": ObjectId(request_id)})
        if request:
            self.update_task(request['task_id'], {"due_date": request['new_deadline']})
            self.db.extension_requests.update_one(
                {"_id": ObjectId(request_id)},
                {"$set": {"status": "Approved"}}
            )
            
            # Notify requester
            self.create_notification(
                request['requester_email'],
                "extension_approved",
                "Your deadline extension request was approved",
                {"task_id": request['task_id']}
            )
    
    def reject_extension_request(self, request_id, reason=""):
        """Reject extension request."""
        request = self.db.extension_requests.find_one({"_id": ObjectId(request_id)})
        if request:
            self.db.extension_requests.update_one(
                {"_id": ObjectId(request_id)},
                {"$set": {"status": "Rejected", "rejection_reason": reason}}
            )
            
            # Notify requester
            self.create_notification(
                request['requester_email'],
                "extension_rejected",
                f"Your deadline extension request was rejected. Reason: {reason}",
                {"task_id": request['task_id']}
            )

    # ==========================================
    # 10. ANALYTICS & STATS (ADVANCED DASHBOARD)
    # ==========================================
    def get_workspace_stats(self, workspace_id):
        """Aggregates metrics for the Workspace Dashboard."""
        # Get all projects
        total_projects = self.db.projects.count_documents({"workspace_id": str(workspace_id)})
        active_projects = self.db.projects.count_documents({"workspace_id": str(workspace_id), "status": "Active"})
        
        # Get all tasks for this workspace to count statuses
        tasks = list(self.db.tasks.find({"workspace_id": str(workspace_id)}))
        total_tasks = len(tasks)
        
        # Count by status
        todo_tasks = sum(1 for t in tasks if t.get('status') == 'To Do')
        in_progress_tasks = sum(1 for t in tasks if t.get('status') == 'In Progress')
        completed_tasks = sum(1 for t in tasks if t.get('status') == 'Completed')
        
        overdue_tasks = self.db.tasks.count_documents({
            "workspace_id": str(workspace_id),
            "due_date": {"$lt": datetime.datetime.utcnow()},
            "status": {"$ne": "Completed"}
        })
        
        return {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "total_tasks": total_tasks,
            "todo_tasks": todo_tasks,
            "in_progress_tasks": in_progress_tasks,
            "completed_tasks": completed_tasks,
            "overdue_tasks": overdue_tasks
        }
    
    def get_project_stats(self, project_id):
        """Get statistics for a specific project."""
        tasks = list(self.db.tasks.find({"project_id": str(project_id)}))
        total_tasks = len(tasks)
        
        if total_tasks == 0:
            return {
                "total_tasks": 0,
                "completed_tasks": 0,
                "in_progress_tasks": 0,
                "todo_tasks": 0,
                "completion_percentage": 0,
                "overdue_tasks": 0
            }
        
        completed = sum(1 for t in tasks if t.get('status') == 'Completed')
        in_progress = sum(1 for t in tasks if t.get('status') == 'In Progress')
        todo = sum(1 for t in tasks if t.get('status') == 'To Do')
        
        overdue = sum(1 for t in tasks if t.get('due_date') and 
                     t['due_date'] < datetime.datetime.utcnow() and 
                     t.get('status') != 'Completed')
        
        completion_pct = round((completed / total_tasks * 100)) if total_tasks > 0 else 0
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed,
            "in_progress_tasks": in_progress,
            "todo_tasks": todo,
            "completion_percentage": completion_pct,
            "overdue_tasks": overdue
        }

    def get_user_stats(self, email):
        """Aggregates metrics for the User Profile."""
        completed = self.db.tasks.count_documents({"assignee": email, "status": "Completed"})
        assigned = self.db.tasks.count_documents({"assignee": email})
        rate = (completed / assigned * 100) if assigned > 0 else 0
        
        # Get time tracking stats
        now = datetime.datetime.utcnow()
        week_start = now - datetime.timedelta(days=now.weekday())
        week_time = self.get_total_time_for_user(email, week_start, now)
        total_time = self.get_total_time_for_user(email)
        
        return {
            "completed": completed,
            "assigned": assigned,
            "rate": round(rate, 1),
            "week_hours": round(week_time / 3600, 1),
            "total_hours": round(total_time / 3600, 1)
        }
    
    def get_employee_performance(self, email, workspace_id=None):
        """Get detailed performance metrics for an employee."""
        query = {"assignee": email}
        if workspace_id:
            query["workspace_id"] = str(workspace_id)
        
        # Get user info
        user = self.get_user(email)
        
        tasks = list(self.db.tasks.find(query))
        assigned = len(tasks)
        completed = sum(1 for t in tasks if t.get('status') == 'Completed')
        completed_on_time = sum(1 for t in tasks if t.get('status') == 'Completed' and t.get('updated_at', t['due_date']) <= t['due_date'])
        completed_late = sum(1 for t in tasks if t.get('status') == 'Completed' and t.get('updated_at', t['due_date']) > t['due_date'])
        in_progress = sum(1 for t in tasks if t.get('status') == 'In Progress')
        overdue = sum(1 for t in tasks if t.get('status') != 'Completed' and t.get('due_date', datetime.datetime.max) < datetime.datetime.utcnow())
        
        # Calculate average completion time
        completed_tasks_with_dates = [t for t in tasks if t.get('status') == 'Completed' and t.get('created_at') and t.get('updated_at')]
        if completed_tasks_with_dates:
            avg_time = sum((t['updated_at'] - t['created_at']).days for t in completed_tasks_with_dates) / len(completed_tasks_with_dates)
        else:
            avg_time = 0
        
        return {
            "name": user['name'] if user else email,
            "email": email,
            "assigned": assigned,
            "completed": completed,
            "total_tasks": assigned,
            "completed_on_time": completed_on_time,
            "completed_late": completed_late,
            "in_progress": in_progress,
            "overdue": overdue,
            "completion_rate": round((completed / assigned * 100), 1) if assigned else 0,
            "avg_completion_time_days": round(avg_time, 1)
        }
    
    def save_reset_token(self, email, token_hash, expiry):
        """Save password reset token for user."""
        self.db.users.update_one(
            {"email": email},
            {"$set": {
                "reset_token": token_hash,
                "reset_token_expiry": expiry
            }}
        )
    
    def reset_password_with_token(self, token, new_password):
        """Reset password using reset token."""
        import hashlib
        import datetime
        
        if not token:
            return False
        
        # Hash the token
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # Find user with valid token
        user = self.db.users.find_one({
            "reset_token": token_hash,
            "reset_token_expiry": {"$gt": datetime.datetime.now()}
        })
        
        if not user:
            return False
        
        # Hash new password
        password_hash = hashlib.sha256(new_password.encode()).hexdigest()
        
        # Update password and clear token
        self.db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"password": password_hash},
                "$unset": {"reset_token": "", "reset_token_expiry": ""}
            }
        )
        
        return True
    
    def get_user_by_email(self, email):
        """Get user by email address."""
        return self.db.users.find_one({"email": email})
    
    # ==========================================
    # 11. TASK TEMPLATES
    # ==========================================
    @property
    def templates(self):
        return self.db["task_templates"]
    
    def get_task_templates(self, workspace_id):
        """Get all active task templates for a workspace."""
        return list(self.templates.find({
            "workspace_id": str(workspace_id),
            "is_active": True
        }).sort("name", 1))
    
    def get_task_template_by_id(self, workspace_id, template_id):
        """Get a single task template by ID."""
        return self.templates.find_one({
            "_id": ObjectId(template_id),
            "workspace_id": str(workspace_id),
        })
    
    def create_task_template(self, workspace_id, name, description, items, created_by):
        """Create a new task template."""
        doc = {
            "workspace_id": str(workspace_id),
            "name": name,
            "description": description or "",
            "items": items or [],
            "created_by": created_by,
            "is_active": True,
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow(),
        }
        return str(self.templates.insert_one(doc).inserted_id)
    
    def update_task_template(self, workspace_id, template_id, updates):
        """Update task template metadata."""
        updates["updated_at"] = datetime.datetime.utcnow()
        return self.templates.update_one(
            {"_id": ObjectId(template_id), "workspace_id": str(workspace_id)},
            {"$set": updates}
        )
    
    def _reorder_items(self, items):
        """Ensure order starts at 1..n."""
        out = []
        for idx, item in enumerate(items, start=1):
            item["order"] = idx
            out.append(item)
        return out
    
    def add_task_template_item(self, workspace_id, template_id, item):
        """Add a new task item to a template."""
        tpl = self.get_task_template_by_id(workspace_id, template_id)
        if not tpl:
            return False
        items = tpl.get("items", [])
        item = dict(item)
        item["order"] = len(items) + 1
        items.append(item)
        items = self._reorder_items(items)
        
        return self.templates.update_one(
            {"_id": ObjectId(template_id), "workspace_id": str(workspace_id)},
            {"$set": {"items": items, "updated_at": datetime.datetime.utcnow()}}
        )
    
    def update_task_template_item(self, workspace_id, template_id, order, updates):
        """Update a specific task item in a template."""
        tpl = self.get_task_template_by_id(workspace_id, template_id)
        if not tpl:
            return False
        items = tpl.get("items", [])
        changed = False
        
        for it in items:
            if int(it.get("order", 0)) == int(order):
                it.update(updates)
                changed = True
                break
        
        if not changed:
            return False
        
        items = self._reorder_items(sorted(items, key=lambda x: x.get("order", 0)))
        return self.templates.update_one(
            {"_id": ObjectId(template_id), "workspace_id": str(workspace_id)},
            {"$set": {"items": items, "updated_at": datetime.datetime.utcnow()}}
        )
    
    def remove_task_template_item(self, workspace_id, template_id, order):
        """Remove a task item from a template."""
        tpl = self.get_task_template_by_id(workspace_id, template_id)
        if not tpl:
            return False
        items = [it for it in tpl.get("items", []) if int(it.get("order", 0)) != int(order)]
        items = self._reorder_items(items)
        
        return self.templates.update_one(
            {"_id": ObjectId(template_id), "workspace_id": str(workspace_id)},
            {"$set": {"items": items, "updated_at": datetime.datetime.utcnow()}}
        )
    
    def delete_task_template(self, template_id):
        """Soft delete a task template."""
        return self.templates.update_one(
            {"_id": ObjectId(template_id)},
            {"$set": {"is_active": False, "updated_at": datetime.datetime.utcnow()}}
        )
    
    def apply_template_to_project(self, workspace_id, project_id, template_id, created_by):
        """Apply a task template to a project by creating tasks."""
        tpl = self.templates.find_one({
            "_id": ObjectId(template_id),
            "workspace_id": str(workspace_id),
            "is_active": True
        })
        
        if not tpl:
            return False
        
        start = datetime.datetime.utcnow()
        items = sorted(tpl.get("items", []), key=lambda x: x.get("order", 0))
        tasks = []
        
        for it in items:
            offset = int(it.get("default_days_offset", 0))
            due = start + datetime.timedelta(days=offset) if offset is not None else None
            
            tasks.append({
                "workspace_id": str(workspace_id),
                "project_id": str(project_id),
                "title": it.get("title", "").strip(),
                "description": it.get("description", "").strip(),
                "priority": it.get("priority", "Medium"),
                "status": "To Do",
                "assignee": created_by,
                "assignee_role": it.get("default_assignee_role", ""),
                "due_date": due,
                "completion_pct": 0,
                "created_at": datetime.datetime.utcnow(),
                "updated_at": datetime.datetime.utcnow(),
                "created_by": created_by,
                "source": "template",
                "template_id": str(template_id),
                "template_name": tpl.get("name", ""),
            })
        
        if tasks:
            self.db.tasks.insert_many(tasks)
        return True
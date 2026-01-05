# 🔧 Quick Integration Guide

## How to Use New Features in Your Pages

### 1. Update render_comment() Calls

**Before:**
```python
render_comment(
    c,
    current_user_email=user_email,
    can_pin=can_pin,
    db=db,
    entity_type="task",
    entity_id=task_id,
    workspace_id=workspace_id,
    project_id=project_id,
    task_id=task_id,
    indent=False
)
```

**After (with new features):**
```python
# Add is_admin parameter
is_admin = (user_role in ["Owner", "Workspace Admin"])

# Add depth tracking for thread limiting
def render_with_depth(comment, current_depth=0):
    render_comment(
        comment,
        current_user_email=user_email,
        can_pin=can_pin,
        db=db,
        entity_type="task",
        entity_id=task_id,
        workspace_id=workspace_id,
        project_id=project_id,
        task_id=task_id,
        indent=False,
        depth=current_depth,  # NEW
        is_admin=is_admin      # NEW
    )
    
    # Render children with incremented depth
    for child in children.get(str(comment["_id"]), []):
        if current_depth < 3:  # Depth limit
            render_with_depth(child, current_depth + 1)
```

---

### 2. Add Task Cards with Urgency Colors

**In `pages/project_details.py`:**

```python
from src.chat_ui import get_urgency_class

# When rendering tasks
for task in filtered:
    urgency_class = get_urgency_class(task.get("priority", "Medium"))
    
    st.markdown(f"""
    <div class="ds-task-card {urgency_class}">
      <div style="font-weight:800; color:#fff;">{task["title"]}</div>
      <div class="ds-row" style="margin-top:8px;">
        <span class="ds-pill">Status: <b>{task["status"]}</b></span>
        <span class="ds-pill">Priority: <b>{task["priority"]}</b></span>
      </div>
    </div>
    """, unsafe_allow_html=True)
```

---

### 3. Add Pulsing Metrics

**In any page with metrics:**

```python
# Critical metrics that need attention
st.markdown("""
<div class="ds-metric-pulse">
  <div style="font-size:14px; color:rgba(255,255,255,0.6); margin-bottom:8px;">
    Overdue Tasks
  </div>
  <div style="font-size:32px; font-weight:900; color:#f44336;">
    {overdue_count}
  </div>
</div>
""", unsafe_allow_html=True)
```

---

### 4. Database Method Stubs (Add to `src/database.py`)

```python
def restore_comment(self, comment_id: str, user_email: str):
    """Restore a soft-deleted comment within 24 hours."""
    comment = self.db["comments"].find_one({"_id": ObjectId(comment_id)})
    if not comment:
        return False
    
    # Check if user is author
    if comment.get("user_email") != user_email:
        return False
    
    # Check if within 24 hours
    deleted_at = comment.get("deleted_at")
    if not deleted_at:
        return False
    
    hours_since = (datetime.datetime.utcnow() - deleted_at).total_seconds() / 3600
    if hours_since > 24:
        return False
    
    # Restore the comment
    self.db["comments"].update_one(
        {"_id": ObjectId(comment_id)},
        {
            "$set": {
                "is_deleted": False,
                "deleted_at": None,
                "deleted_by": None
            }
        }
    )
    return True

def get_edit_history(self, comment_id: str):
    """Get edit history for a comment."""
    comment = self.db["comments"].find_one({"_id": ObjectId(comment_id)})
    return comment.get("edit_history", []) if comment else []

def delete_comment(self, comment_id: str, actor_email: str, is_admin_action: bool = False):
    """
    Soft delete a comment.
    If is_admin_action=True, skip author check.
    """
    comment = self.db["comments"].find_one({"_id": ObjectId(comment_id)})
    if not comment:
        return
    
    # Check permissions
    if not is_admin_action and comment.get("user_email") != actor_email:
        return
    
    self.db["comments"].update_one(
        {"_id": ObjectId(comment_id)},
        {
            "$set": {
                "is_deleted": True,
                "deleted_at": datetime.datetime.utcnow(),
                "deleted_by": actor_email,
                "is_admin_action": is_admin_action
            }
        }
    )

def edit_comment(self, comment_id: str, actor_email: str, new_text: str):
    """
    Edit a comment and track history.
    """
    comment = self.db["comments"].find_one({"_id": ObjectId(comment_id)})
    if not comment or comment.get("user_email") != actor_email:
        return
    
    # Store in edit history
    previous_text = comment.get("text", "")
    edit_entry = {
        "timestamp": datetime.datetime.utcnow(),
        "previous_text": previous_text,
        "edited_by": actor_email
    }
    
    self.db["comments"].update_one(
        {"_id": ObjectId(comment_id)},
        {
            "$set": {
                "text": new_text,
                "edited_at": datetime.datetime.utcnow()
            },
            "$inc": {
                "edit_count": 1
            },
            "$push": {
                "edit_history": edit_entry
            }
        }
    )
```

---

### 5. Complete Example: Updated Discussion Section

```python
# pages/task_details.py (discussion section)

st.markdown("### Discussion")

# Session state setup
if "reply_to_comment_id" not in st.session_state:
    st.session_state.reply_to_comment_id = None
if "edit_comment_id" not in st.session_state:
    st.session_state.edit_comment_id = None

# Permissions
is_admin = (user_role in ["Owner", "Workspace Admin"])
can_pin = is_admin

# Filters
f1, f2 = st.columns([1, 2])
with f1:
    pinned_only = st.toggle("Pinned only", value=False)
with f2:
    members = db.get_workspace_members_for_mentions(workspace_id) or []
    mention_options = ["None"] + [f"{m['name']} ({m['email']})" for m in members]
    selected = st.selectbox("Mention", mention_options)

# Compose form (same as before)
# ...

# Get comments
comments = db.get_comments("task", task_id, pinned_only=pinned_only) or []
top, children = build_threads(comments)

# Helper function for depth-aware rendering
def render_thread(comment, depth=0):
    render_comment(
        comment,
        current_user_email=user_email,
        can_pin=can_pin,
        db=db,
        entity_type="task",
        entity_id=task_id,
        workspace_id=workspace_id,
        project_id=task.get("project_id"),
        task_id=task_id,
        indent=False,
        depth=depth,
        is_admin=is_admin
    )
    
    # Render children (up to depth 3)
    if depth < 3:
        for child in children.get(str(comment["_id"]), []):
            render_thread(child, depth + 1)

# Render pinned
if not pinned_only:
    pinned = [c for c in top if c.get("is_pinned")]
    if pinned:
        st.caption("📌 Pinned")
        for c in pinned:
            render_thread(c, 0)

# Render all threads
st.caption("Threads")
threads = sorted(top, key=lambda x: x.get("created_at") or datetime.datetime.min, reverse=True)
for c in threads:
    if (not pinned_only) and c.get("is_pinned"):
        continue
    render_thread(c, 0)
```

---

## 🎯 Migration Checklist

### Files to Update

- [ ] `pages/project_details.py`
  - [ ] Add `is_admin` parameter
  - [ ] Update `render_comment()` calls with `depth` and `is_admin`
  - [ ] Add task urgency colors
  - [ ] Add metric pulse animations (optional)

- [ ] `pages/task_details.py`
  - [ ] Add `is_admin` parameter
  - [ ] Update `render_comment()` calls with `depth` and `is_admin`
  - [ ] Add task urgency colors (if showing subtasks)

- [ ] `src/database.py`
  - [ ] Add `restore_comment()` method
  - [ ] Update `delete_comment()` to support admin actions
  - [ ] Update `edit_comment()` to track history
  - [ ] Add `get_edit_history()` method

### Testing Steps

1. **Thread Depth**:
   - Create a deeply nested thread (4+ levels)
   - Verify "Continue thread →" appears at level 4
   - Verify no rendering beyond level 3

2. **Urgency Colors**:
   - View tasks with different priorities
   - Verify left border colors match priority

3. **Admin Actions**:
   - Login as admin
   - Attempt to delete other users' comments
   - Verify hammer icon (🔨) appears

4. **Restore Deleted**:
   - Delete your own comment
   - Verify restore button (♻️) appears
   - Restore the comment
   - Wait 24+ hours, verify restore button disappears

5. **Edit History**:
   - Edit a comment multiple times
   - Verify edit count badge appears
   - Verify "✏️ X edits" shows correct count

6. **Mobile Responsive**:
   - Resize browser to < 768px
   - Verify thread indentation reduces
   - Verify no horizontal scroll

---

## 🐛 Common Issues & Solutions

### Issue: "Continue thread" button doesn't stop rendering

**Solution**: Make sure `render_comment()` returns early when `depth >= 3`:

```python
if depth >= 3:
    st.markdown('...continue thread button...')
    return  # IMPORTANT: Stop here
```

### Issue: Admin can't delete comments

**Solution**: Check `is_admin` is passed correctly:

```python
is_admin = (user_role in ["Owner", "Workspace Admin"])
# NOT: is_admin = user_role == "Admin"  ❌
```

### Issue: Task urgency colors not showing

**Solution**: Ensure class is applied correctly:

```python
# Correct ✅
f'<div class="ds-task-card {urgency_class}">'

# Wrong ❌
f'<div class="ds-task-card" class="{urgency_class}">'
```

---

**Quick Start**: Focus on implementing depth limiting and admin actions first, then add visual enhancements like pulse animations and urgency colors.

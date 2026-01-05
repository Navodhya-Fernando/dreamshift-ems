# Chat Features Implementation Guide

## Overview
This guide documents the modern chat features added to both Project Details and Task Details pages, including comments with reactions, pinning, @mentions, **reply threading**, **edit/delete**, and **mention autocomplete**.

## Features Implemented

### 1. **Username Display**
- Comments show the user's full name (not email)
- User names are stored at comment creation time for fast rendering
- Falls back to email if no name is available

### 2. **@Mentions**
- Users can mention others using `@name` or `@email` syntax
- Mentions are highlighted in golden color (#f6b900)
- Mentioned users receive notifications (existing notification system)
- Basic parsing with regex: `r'(@[\w\.\-\+@]+)'`
- **NEW: Autocomplete dropdown** - Select workspace members from dropdown to insert mentions

### 3. **Reactions**
- 5 reaction types: 👍 ❤️ 🎉 👀 ✅
- Users can toggle reactions on/off
- Shows count of users who reacted
- Visual indication when current user has reacted (primary button)
- Stored as map of emoji to list of user emails

### 4. **Pin/Unpin Comments**
- Authors can pin their own comments
- Workspace admins can pin any comment
- Pinned comments appear in separate section at top
- Shows who pinned and when
- Toggle functionality with "Pin"/"Unpin" button
- **NEW: Pinned-only filter** - Toggle to show only pinned comments

### 5. **Reply Threading** ⭐ NEW
- Reply to any comment to create threaded discussions
- Replies are indented (28px) under parent comments
- Parent-child relationship tracked with `parent_comment_id`
- Replies sorted oldest-first (chat-like feel)
- Visual hierarchy with indentation

### 6. **Edit/Delete Comments** ⭐ NEW
- Authors can edit their own comments
- Authors can delete their own comments (soft delete)
- Edited comments show "Edited" badge
- Deleted comments show "This comment was deleted." message
- Edit form appears inline when editing
- Timestamps tracked for edits and deletions

### 7. **Modern UI Design**
- Minimal cards with subtle borders
- Clean spacing (10-14px gaps)
- Font weights: 800-900 for headers, 700 for important text
- Color scheme:
  - Primary: #ffffff
  - Secondary: rgba(255,255,255,0.65-0.75)
  - Golden accent: #f6b900
  - Background: #16213e, #1a1a2e
- Inline CSS for component-specific styling

## Database Schema

### Comments Collection (Updated)
```json
{
  "_id": "ObjectId(...)",
  "entity_type": "task",           // or "project"
  "entity_id": "TASK_ID",
  "workspace_id": "WS_ID",
  "project_id": "PROJECT_ID",
  "task_id": "TASK_ID",           // null for project comments
  "user_email": "user@example.com",
  "user_name": "John Doe",        // stored at creation
  "text": "Comment body with @mentions",
  "created_at": "2025-01-05T00:00:00Z",
  "is_pinned": false,
  "pinned_at": null,
  "pinned_by": null,
  "reactions": {
    "👍": ["user1@ex.com", "user2@ex.com"],
    "❤️": ["user3@ex.com"]
  },
  "parent_comment_id": null,       // NEW: ObjectId or null for threading
  "edited_at": null,               // NEW: timestamp of last edit
  "is_deleted": false,             // NEW: soft delete flag
  "deleted_at": null               // NEW: timestamp of deletion
}
```

## Database Methods

### `get_display_name(email)`
Returns user's display name or falls back to email.

```python
db.get_display_name("user@example.com")
# Returns: "John Doe" or "user@example.com"
```

### `get_workspace_member_emails(workspace_id)` ⭐ NEW
Returns list of member emails in workspace.

```python
emails = db.get_workspace_member_emails(workspace_id)
# Returns: ["user1@ex.com", "user2@ex.com", ...]
```

### `get_workspace_members_for_mentions(workspace_id)` ⭐ NEW
Returns workspace members with name/email for mention autocomplete.

```python
members = db.get_workspace_members_for_mentions(workspace_id)
# Returns: [{"email": "user@ex.com", "name": "John Doe"}, ...]
# Sorted alphabetically by name
```

### `add_comment(entity_type, entity_id, user_email, text, workspace_id, project_id, task_id, parent_comment_id)` - UPDATED
Creates a new comment with reactions, pin support, and threading.

```python
# Top-level comment
db.add_comment(
    "task", 
    task_id, 
    user_email, 
    "Great work @john!",
    workspace_id=ws_id,
    project_id=proj_id,
    task_id=task_id,
    parent_comment_id=None  # NEW parameter
)

# Reply to comment
db.add_comment(
    "task", 
    task_id, 
    user_email, 
    "Thanks!",
    workspace_id=ws_id,
    project_id=proj_id,
    task_id=task_id,
    parent_comment_id=parent_comment_id  # Reply to this comment
)
```

### `get_comments(entity_type, entity_id, pinned_only)` - UPDATED
Returns comments sorted by pinned first, then by created_at descending.

```python
# Get all comments
comments = db.get_comments("task", task_id)

# Get only pinned comments (NEW)
pinned_comments = db.get_comments("task", task_id, pinned_only=True)
```

### `toggle_pin_comment(comment_id, actor_email, is_pinned)`
Pins or unpins a comment.

```python
db.toggle_pin_comment(comment_id, user_email, True)  # Pin
db.toggle_pin_comment(comment_id, user_email, False) # Unpin
```

### `toggle_reaction(comment_id, emoji, user_email)`
Toggles a user's reaction on a comment.

```python
db.toggle_reaction(comment_id, "👍", user_email)
# Adds reaction if not present, removes if already reacted
```

### `edit_comment(comment_id, actor_email, new_text)` ⭐ NEW
Edits a comment (author only).

```python
success = db.edit_comment(comment_id, user_email, "Updated text")
# Returns True if edited, False if not allowed or not found
# Sets edited_at timestamp
```

### `delete_comment(comment_id, actor_email)` ⭐ NEW
Soft deletes a comment (author only).

```python
success = db.delete_comment(comment_id, user_email)
# Returns True if deleted, False if not allowed or not found
# Sets is_deleted=True and deleted_at timestamp
```

### `update_task_priority(task_id, priority)`
Updates task priority.

```python
db.update_task_priority(task_id, "High")
```

## UI Components

### Project Details Page (`project_details.py`)
- **Header**: Project name and description with gradient background
- **Info Strip**: Service, Deadline, Status with overdue indicator
- **Stats Row**: Total tasks, Completed, In Progress, Completion %
- **Task List**: Searchable and filterable task cards
- **Discussion**: Comment section with reactions and pinning

### Task Details Page (`task_details.py`)
- **Header**: Task title with project context
- **Meta Chips**: Assignee, Status, Priority, Due date, Progress
- **Left Column**:
  - Description
  - Subtasks with progress bar
  - Discussion (chat with reactions/pins)
  - Time tracking with timer
- **Right Column**:
  - Actions (Status, Priority updates)
  - Task details (Created, Updated dates)
  - Extension request form

## Comment Rendering Pattern

```python
def render_comment(c):
    """Render a single comment with reactions and pin."""
    cid = str(c["_id"])
    author = c.get("user_name") or c.get("user_email")
    is_author = (c.get("user_email") == user_email)
    can_pin = is_author or st.session_state.get("user_role") in ["Owner", "Workspace Admin"]
    
    # Highlight @mentions
    import re
    def highlight_mentions(txt):
        return re.sub(r'(@\S+)', r'<span style="color:#f6b900;font-weight:700;">\1</span>', txt)
    
    text_html = highlight_mentions(c.get("text", ""))
    
    reactions = c.get("reactions", {}) or {}
    reaction_order = ["👍", "❤️", "🎉", "👀", "✅"]
    
    # Time ago calculation
    created = c.get("created_at")
    if created:
        delta = datetime.datetime.utcnow() - created
        if delta.days > 0:
            time_str = f"{delta.days}d ago"
        elif delta.seconds // 3600 > 0:
            time_str = f"{delta.seconds // 3600}h ago"
        else:
            time_str = f"{delta.seconds // 60}m ago"
    
    # Render comment card
    # Render reaction buttons
    # Render pin/unpin button
```

## Usage Examples

### Adding a Comment
```python
with st.form("add_comment_task", clear_on_submit=True):
    new_comment = st.text_area("Add a comment", placeholder="@mention users...", height=100)
    if st.form_submit_button("Post"):
        if new_comment.strip():
            db.add_comment(
                "task", 
                task_id, 
                user_email, 
                new_comment.strip(),
                workspace_id=workspace_id,
                project_id=project_id,
                task_id=task_id
            )
            st.success("Comment added!")
            st.rerun()
```

### Rendering Comments
```python
comments = db.get_comments("task", task_id)

# Render pinned comments
pinned = [c for c in comments if c.get("is_pinned")]
if pinned:
    st.markdown("📌 Pinned")
    for c in pinned:
        render_comment(c)

# Render all comments
st.markdown("All Comments")
for c in comments:
    if not c.get("is_pinned"):
        render_comment(c)
```

### Reaction Buttons
```python
cols = st.columns(5)
reaction_order = ["👍", "❤️", "🎉", "👀", "✅"]
for idx, emoji in enumerate(reaction_order):
    with cols[idx]:
        users_reacted = reactions.get(emoji, [])
        count = len(users_reacted)
        has_reacted = user_email in users_reacted
        label = f"{emoji} {count}" if count > 0 else emoji
        btn_type = "primary" if has_reacted else "secondary"
        
        if st.button(label, key=f"react_{comment_id}_{emoji}", type=btn_type):
            db.toggle_reaction(comment_id, emoji, user_email)
            st.rerun()
```

## Future Enhancements

1. ~~**Reply Threading**~~ ✅ IMPLEMENTED
2. ~~**Edit/Delete**~~ ✅ IMPLEMENTED
3. **Rich Text**: Support for markdown formatting in comments
4. **File Attachments**: Attach files to comments
5. **Emoji Picker**: Visual emoji selector
6. **Real-time Updates**: WebSocket for live comment updates
7. **Notification Settings**: Configure mention notifications
8. **Comment Search**: Search within comments
9. **Reaction Analytics**: See who reacted to what
10. **Quote Reply**: Quote specific text when replying

## Testing Checklist

**Basic Features:**
- [ ] Create comment on task
- [ ] Create comment on project
- [ ] @mention a user (notification created)
- [ ] Add reaction to comment
- [ ] Remove reaction from comment
- [ ] Pin comment as author
- [ ] Pin comment as admin
- [ ] Unpin comment
- [ ] View pinned comments section
- [ ] Check comment sorting (pinned first, then latest)
- [ ] Verify username display (not email)
- [ ] Check @mention highlighting in golden color
- [ ] Test reaction count display
- [ ] Verify "time ago" formatting
- [ ] Update task priority
- [ ] Test with no comments
- [ ] Test with no reactions
- [ ] Test permission checks for pinning

**New Features:** ⭐
- [ ] Reply to a comment (creates threaded reply)
- [ ] Reply to a reply (multi-level threading)
- [ ] View threaded replies with indentation
- [ ] Edit own comment (shows "Edited" badge)
- [ ] Try to edit someone else's comment (should fail)
- [ ] Delete own comment (shows "deleted" message)
- [ ] Try to delete someone else's comment (should fail)
- [ ] React to a reply
- [ ] Pin a reply
- [ ] Use mention autocomplete dropdown
- [ ] Insert mention from autocomplete
- [ ] Toggle "Pinned only" filter
- [ ] View only pinned comments with filter
- [ ] Reply to deleted comment (should be disabled)
- [ ] Edit deleted comment (should be disabled)

## Files Modified

1. **`src/database.py`**
   - Added `get_workspace_member_emails(workspace_id)` method ⭐ NEW
   - Added `get_workspace_members_for_mentions(workspace_id)` method ⭐ NEW
   - Updated `add_comment()` with threading support (`parent_comment_id` parameter) ⭐ UPDATED
   - Updated `get_comments()` with `pinned_only` filter ⭐ UPDATED
   - Added `edit_comment(comment_id, actor_email, new_text)` method ⭐ NEW
   - Added `delete_comment(comment_id, actor_email)` method ⭐ NEW
   - Kept `get_display_name(email)` method
   - Kept `toggle_pin_comment()` method
   - Kept `toggle_reaction()` method
   - Kept `update_task_priority()` method

2. **`pages/project_details.py`**
   - Complete redesign with modern minimal UI
   - Added discussion section with reactions/pins
   - Added task search and filters
   - Shows assignee by name

3. **`pages/task_details.py`**
   - Complete redesign with modern minimal UI
   - **UPGRADED** discussion section with: ⭐
     - Reply threading with indentation
     - Edit/Delete for authors
     - Mention autocomplete dropdown
     - Pinned-only filter toggle
     - Inline edit and reply forms
     - "Edited" and "Deleted" badges
   - Added priority update functionality
   - Improved time tracking display
   - Added extension request form

## Key Implementation Details

### Threading Algorithm

```python
# Build thread map
all_comments = db.get_comments("task", task_id)
top_level = [c for c in all_comments if not c.get("parent_comment_id")]
children_map = {}
for c in all_comments:
    pid = c.get("parent_comment_id")
    if pid:
        children_map.setdefault(str(pid), []).append(c)

# Sort replies oldest-first
for pid in children_map:
    children_map[pid] = sorted(children_map[pid], 
                                key=lambda x: x.get("created_at") or datetime.datetime.min)

# Render with recursion/indentation
for parent in top_level:
    render_comment_card(parent, indent_px=0)
    for child in children_map.get(str(parent["_id"]), []):
        render_comment_card(child, indent_px=28)
```

### Mention Autocomplete

```python
# Get workspace members
members = db.get_workspace_members_for_mentions(workspace_id)
mention_options = [f"{m['name']} ({m['email']})" for m in members]

# User selects from dropdown
selected_mention = st.selectbox("Mention someone", ["None"] + mention_options)

# Insert into compose box
if selected_mention != "None":
    m = mention_map[selected_mention]
    tag = f"@{m['email']}"
    if tag not in st.session_state.compose_comment:
        st.session_state.compose_comment += tag + " "
```

### Edit/Delete Permissions

```python
def edit_comment(self, comment_id: str, actor_email: str, new_text: str):
    c = self.db.comments.find_one({"_id": ObjectId(comment_id)})
    if not c:
        return False
    if c.get("user_email") != actor_email:  # Author only
        return False
    if c.get("is_deleted"):  # Can't edit deleted
        return False
    
    # Update text and set edited_at
    return bool(
        self.db.comments.update_one(
            {"_id": ObjectId(comment_id)},
            {"$set": {"text": new_text.strip(), "edited_at": datetime.datetime.utcnow()}}
        ).modified_count
    )
```

## Support

For questions or issues with chat features:
1. Check this guide for implementation details
2. Review database methods in `src/database.py`
3. Test with sample data in MongoDB
4. Check browser console for JavaScript errors
5. Verify user permissions for pin operations

# DreamShift EMS - Implementation Roadmap

## ✅ Completed Features

### 1. Color Scheme & Branding
- **Background**: `#24101a` applied throughout
- **Primary buttons**: `#f6b900` with `#411c30` text
- **Hover state**: `#ffc933` (lighter gold)
- **User avatars**: `#f6b900` background with `#411c30` text
- **Email templates**: Updated button colors

### 2. Workspace & Member Management
- ✅ All workspaces visible to all users (no restrictions)
- ✅ Workspace switcher in sidebar
- ✅ Member management shows names (fallback to email username)
- ✅ Inline workspace creation form

### 3. Task & Project Creation
- ✅ Task creation with name selection (not email input)
- ✅ Project creation with assignee dropdown
- ✅ Member names displayed throughout (tasks list, projects, workspaces)
- ✅ Duplicate name handling (appends email in parentheses)

### 4. Comments & Mentions
- ✅ @mention support for both names and emails
- ✅ Workspace-aware name lookup
- ✅ Inbox notifications for mentions
- ✅ Mention highlighting in chat UI
- ✅ Comments on tasks AND projects
- ✅ Full chat features: replies, reactions, edit, delete, pin

### 5. UI Components
- ✅ Custom sidebar with Material Design icons
- ✅ Workspace switcher at top of sidebar
- ✅ User profile card in sidebar
- ✅ Timezone-aware greeting (JavaScript detection)
- ✅ Custom SVG icons for time-of-day

### 6. Bug Fixes
- ✅ Fixed duplicate sidebar sections
- ✅ Fixed project-details crash on missing project
- ✅ Fixed avatar color consistency (#411c30)
- ✅ Fixed indentation in get_user_workspaces

---

## 🚀 Next Steps (Optional Enhancements)

### A. Advanced UI Polish

#### 1. Comment Threading Depth Indicator
**File**: `src/chat_ui.py`
- Already has depth limiting (max 3 levels)
- Consider adding visual depth indicators (indent bars)

#### 2. Enhanced Forms with Validation
**Files**: `pages/tasks.py`, `pages/projects.py`
- Add client-side validation hints
- Show character counts for text fields
- Add "Required" labels with red asterisks

#### 3. Loading States
**All page files**
- Add `st.spinner()` for database operations
- Show skeleton loaders for task/project lists

### B. Feature Additions

#### 1. Task Templates
**New file**: `pages/task-templates.py`
```python
# Allow creating reusable task templates
# Fields: template_name, default_priority, checklist_items, default_assignee_role
```

#### 2. Project Templates
**Update**: `pages/projects.py`
- Add template selector in project creation
- Auto-create tasks from template when project is created

#### 3. Advanced Search
**New file**: `pages/search.py`
- Full-text search across tasks, projects, comments
- Filter by workspace, assignee, date range, priority

#### 4. Activity Feed
**Update**: `pages/inbox.py`
- Show all workspace activity (not just mentions)
- Filter by: comments, task updates, assignments, mentions

### C. Performance Optimizations

#### 1. Caching Strategy
**File**: `src/database.py`
```python
@st.cache_data(ttl=60)
def get_workspace_members(workspace_id):
    # Already implemented, just add caching
```

#### 2. Pagination
**Files**: `pages/tasks.py`, `pages/projects.py`
- Limit results to 50 per page
- Add "Load More" button or page navigation

### D. Advanced Chat Features

#### 1. File Attachments
**Update**: `src/database.py`, `src/chat_ui.py`
- Allow attaching files to comments
- Store in database as base64 or use external storage

#### 2. Rich Text Editor
**Update**: `src/chat_ui.py`
- Replace `st.text_area` with custom rich text component
- Support **bold**, *italic*, `code`, lists

#### 3. Emoji Reactions (Extended)
**Update**: `src/chat_ui.py`
- Add more reaction options
- Show reaction counts inline

---

## 📋 Current Feature Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| Task Creation | ✅ Complete | Name-based assignee selection |
| Project Creation | ✅ Complete | Name-based assignee selection |
| Comments on Tasks | ✅ Complete | Full threading, reactions, @mentions |
| Comments on Projects | ✅ Complete | Same features as task comments |
| Workspace Switcher | ✅ Complete | Shows all workspaces |
| Member Management | ✅ Complete | Shows names, not emails |
| @Mentions by Name | ✅ Complete | Workspace-aware lookup |
| Color Scheme | ✅ Complete | #24101a bg, #f6b900 buttons, #411c30 text |
| Timezone Detection | ✅ Complete | Client-side JavaScript |
| Time Tracking | ✅ Complete | Start/stop timer on tasks |
| Subtasks | ✅ Complete | Checkbox list with progress bar |
| Extension Requests | ✅ Complete | Admin inbox notifications |
| Custom Statuses | ✅ Complete | Per-workspace workflow columns |

---

## 🔧 Technical Debt & Cleanup

### 1. Remove Unused Imports
Check all page files for unused imports from the emoji → Material icon migration.

### 2. Consolidate CSS
**File**: `static/styles.css`
- Remove redundant rules
- Add CSS variables for all colors
- Group by component type

### 3. Database Indexes
**MongoDB**
```javascript
db.tasks.createIndex({ workspace_id: 1, status: 1 })
db.comments.createIndex({ entity_type: 1, entity_id: 1 })
db.notifications.createIndex({ user_email: 1, read: 1 })
```

### 4. Environment Variables
**File**: `.env.example`
```bash
MONGODB_URI=mongodb+srv://...
DB_NAME=dreamshift
BREVO_API_KEY=xkeysib-...
BREVO_FROM_EMAIL=noreply@dreamshift.net
```

---

## 📊 Deployment Checklist

### Streamlit Cloud
- [x] Main file set to `Home.py`
- [x] Secrets configured (MONGODB_URI, BREVO_API_KEY)
- [x] Dependencies updated (bcrypt>=4.0.0)
- [ ] Custom domain configured (optional)
- [ ] Analytics integrated (optional)

### Production Best Practices
- [ ] Add error tracking (Sentry)
- [ ] Set up monitoring (UptimeRobot)
- [ ] Configure backups (MongoDB Atlas)
- [ ] Add rate limiting for API calls
- [ ] Implement session timeout

---

## 🎨 Design System

### Colors
```css
--primary: #f6b900      /* Buttons, accents */
--primary-hover: #ffc933
--primary-text: #411c30 /* Text on buttons */
--bg-dark: #24101a      /* Main background */
--bg-card: rgba(255,255,255,0.03)
--border: rgba(255,255,255,0.1)
--text: #ffffff
--text-muted: #888
```

### Typography
- **Headers**: Inter, 800 weight
- **Body**: Inter, 400-600 weight
- **Code**: Monospace

### Spacing
- **Card padding**: 12-20px
- **Section gaps**: 20px
- **Form gaps**: 15px

---

## 🚦 Priority Levels

### P0 - Critical (Must Have)
✅ All implemented

### P1 - High (Should Have)
- Task templates
- Advanced search
- File attachments in comments

### P2 - Medium (Nice to Have)
- Rich text editor
- Activity feed
- Pagination

### P3 - Low (Future)
- Mobile app
- Desktop notifications
- Integration with Google Calendar
- AI-powered task suggestions

---

## 📝 Notes

### Known Limitations
1. **Workspace access**: Currently ALL workspaces visible to all users (intentional per requirements)
2. **Email notifications**: Disabled for deadlines (inbox-only per requirements)
3. **File uploads**: Not implemented yet (requires external storage)

### Migration Required
If you have existing users without `name` field in database:
```javascript
// Run this in MongoDB shell
db.users.updateMany(
  { name: { $exists: false } },
  { $set: { name: "$email" } }
)
```

### Performance Considerations
- Workspace member lookup is called frequently (consider caching)
- Comment threading can be slow with 100+ comments (consider pagination)
- @mention parsing runs on every comment post (consider debouncing)

---

## 🤝 Contributing

When adding new features:
1. Follow the color scheme (#f6b900, #411c30, #24101a)
2. Use Material Design icons (`:material/icon_name:`)
3. Add type hints to Python functions
4. Update this roadmap with status
5. Test on both light and dark mode browsers

---

Last Updated: January 22, 2026

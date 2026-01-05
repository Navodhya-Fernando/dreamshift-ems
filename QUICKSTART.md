# 🚀 Quick Start Guide - DreamShift EMS

## Get Running in 5 Minutes!

### Step 1: Install Dependencies (1 minute)
```bash
pip install -r requirements.txt
```

### Step 2: Set Up MongoDB (2 minutes)

#### Option A: MongoDB Atlas (Free Cloud Database)
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account
3. Create free cluster
4. Click "Connect" → "Connect your application"
5. Copy connection string

#### Option B: Local MongoDB
```bash
# If you have MongoDB installed locally
mongodb://localhost:27017/
```

### Step 3: Configure Environment (1 minute)
Create `.env` file in project root:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=dreamshift_ems
```

**Replace** `username:password@cluster` with your actual MongoDB connection details!

### Step 4: Run the App! (1 minute)
```bash
streamlit run app.py
```

Browser opens automatically at `http://localhost:8501` 🎉

---

## First Time Setup (In the App)

### 1. Create Your Account (30 seconds)
- Click "Sign Up" on login page
- Enter your name, email, and password
- Click "Create Account"
- Now login with those credentials

### 2. Create Your First Workspace (30 seconds)
- After login, go to "Workspaces" page (sidebar)
- Click "Create Workspace"
- Enter workspace name (e.g., "My Company")
- You're automatically the Owner!

### 3. Add Team Members (1 minute)
- In Workspaces page, expand "Manage Members"
- Enter team member email
- Select role (Owner/Admin/Employee)
- Click "Add Member"
- Repeat for all team members

### 4. Create Your First Project (1 minute)
- Go to "Projects" page
- Click "Create New Project"
- Enter:
  - Project name (e.g., "Website Redesign")
  - Service offering (e.g., "Gold Package")
  - Description
  - Deadline
- Click "Create Project"

### 5. Create Your First Task (1 minute)
- Go to "Tasks" page (Kanban board)
- Click "Create Task" or use the form
- Fill in:
  - Task title
  - Description
  - Assign to someone
  - Due date
  - Priority
- Click "Create Task"

### 6. Explore Features! (5 minutes)
Try these:
- ✅ Click on a task to see details
- ⏱️ Click "Start Timer" to track time
- 💬 Add a comment with @email to mention someone
- 📅 Go to Calendar to see due dates
- 👤 Check your Profile for stats
- ⚙️ Visit Settings to customize

---

## Common First-Time Issues

### "Can't connect to database"
**Problem:** MongoDB URI is wrong or network access not allowed
**Fix:**
1. Check your `.env` file
2. In MongoDB Atlas: Database Access → Add your IP address
3. Try connection string again

### "Page not found"
**Problem:** File path issue
**Fix:** Make sure you're running from project root directory

### "CSS not loading"
**Problem:** Static files path
**Fix:** Check `static/styles.css` exists in correct location

### "No workspace found"
**Problem:** Didn't create workspace yet
**Fix:** Go to Workspaces page and create one first

---

## Quick Feature Tour

### 🏠 Home Dashboard
- See all your tasks
- Track urgent/overdue items
- View recent activity
- Quick actions sidebar

### 📋 Task Details
- Click any task card
- Add subtasks (checklist)
- Post comments
- Track time with timer
- Request deadline extension

### 👤 Profile
- View your stats
- See completion rate
- Check time logs
- Achievements

### ⚙️ Settings
- Change theme
- Set notification preferences
- Update password
- Connect calendar

---

## Pro Tips for New Users

1. **Start small** - Create 2-3 tasks first, get familiar
2. **Use @mentions** - Tag people in comments: `@john@company.com`
3. **Track time** - Click "Track Time" on tasks you're working on
4. **Check notifications** - Bell icon in sidebar shows updates
5. **Use calendar** - Calendar view helps visualize deadlines
6. **Set priorities** - Use priority levels to focus on important work
7. **Break down tasks** - Use subtasks for complex tasks
8. **Request extensions** - Don't miss deadlines, request extension if needed

---

## Default Test Data (Optional)

Want some sample data to explore? Run this in MongoDB:

```javascript
// Insert sample project
db.projects.insertOne({
  workspace_id: "your_workspace_id_here",
  name: "Sample Project",
  description: "This is a test project",
  service_offering: "Gold Package",
  deadline: new Date("2026-03-01"),
  status: "Active",
  created_at: new Date()
})

// Insert sample task
db.tasks.insertOne({
  project_id: "project_id_here",
  workspace_id: "workspace_id_here",
  title: "Design Homepage Mockup",
  description: "Create initial design mockups for the new homepage",
  assignee: "your@email.com",
  due_date: new Date("2026-02-15"),
  priority: "High",
  status: "To Do",
  subtasks: [],
  completion_pct: 0,
  created_at: new Date()
})
```

---

## Next Steps

1. ✅ **You're running!** The app is working
2. 📖 **Read README.md** for full feature list
3. 🛠️ **Complete remaining pages** using IMPLEMENTATION_GUIDE.md
4. 🎨 **Customize UI** in static/styles.css
5. 🚀 **Deploy** to Streamlit Cloud when ready

---

## Getting Help

**Documentation:**
- `README.md` - Feature overview
- `IMPLEMENTATION_GUIDE.md` - How to complete pages
- `SUMMARY.md` - What's done, what's left

**Database Methods:**
See `src/database.py` - all methods have docstrings

**UI Patterns:**
Look at `app.py` or `pages/task_details.py` for examples

**Stuck?** Check IMPLEMENTATION_GUIDE.md - it has solutions for common tasks!

---

## Keyboard Shortcuts (Coming Soon)

These can be added in future:
- `Ctrl + K` - Search
- `Ctrl + N` - New task
- `Ctrl + /` - Command palette
- `Esc` - Close modals

---

## 🎉 You're Ready!

Your DreamShift EMS is running. Start creating projects and managing your team!

**Enjoy your new project management system! 🚀**

# Quick Reference: Workspace Visibility Features

## What Changed

### 1. Everyone Can See All Workspaces ✓
- **Before**: Users only saw workspaces they were members of
- **After**: All users see ALL workspaces in the sidebar selector
- **Action**: Open workspace dropdown → all workspaces listed

### 2. Switch Between Any Workspace ✓
- **Before**: Users could only work in their own workspaces
- **After**: Users can switch to any workspace (as guest if not member)
- **Result**: Switch as guest and view projects/tasks without permissions to modify

### 3. Membership Status Badge ✓
The sidebar now shows your status in each workspace:

| Status | Meaning | Permissions |
|--------|---------|-------------|
| `✓ Owner` | You own this workspace | Full access + all features |
| `✓ Workspace Admin` | You're an admin | Manage projects, invite members |
| `✓ Employee` | You're a member | View and complete assigned tasks |
| `Guest (View Only)` | You're not a member | View only, no modifications |

### 4. Member Mentions Show Status ✓
When mentioning someone in comments:

```
John Smith (john@company.com) ✓   ← In this workspace
Sarah Jones (sarah@company.com) ○ ← Not in this workspace
```

- `✓` = Member of current workspace
- `○` = Not a member (can still be mentioned)

## Feature Highlights

### Guest Access
```
Guest users CAN:
✓ View projects and their details
✓ Read tasks and comments
✓ Browse workspace structure
✓ View analytics and reports

Guest users CANNOT:
✗ Create projects
✗ Create/modify tasks
✗ Invite members
✗ Change workspace settings
✗ Delete content
```

### Member Access
Members have full permissions based on their role:
- **Owner**: Complete control
- **Workspace Admin**: Can invite, create projects, modify settings
- **Employee**: Can work on assigned tasks and projects

## Use Cases

### Use Case 1: Cross-Workspace Review
"I need to check something in another team's workspace"
1. Open workspace selector (sidebar)
2. Choose workspace
3. View as guest (or request membership)

### Use Case 2: Mention External Collaboration
"I want to mention someone who isn't in this workspace"
1. Add comment/description
2. Use mention feature
3. Select person (even if they show `○` - not in workspace)

### Use Case 3: Cross-Team Communication
"I need to invite someone from another workspace"
1. Go to Team tab
2. Click "Invite Member"
3. Person can join and will see workspace in their list

## Technical Notes

- **Database**: `get_all_workspaces()` retrieves all workspaces
- **Permissions**: Based on `db.get_user_role()` (returns None for non-members)
- **Session State**: Stores `user_role` and `is_workspace_member` flags
- **UI**: Uses `✓` and `○` symbols for clear visual distinction

## Admin Tips

### Want to prevent someone from accessing a workspace?
- Remove them from workspace members list
- They'll see workspace but as "Guest (View Only)"

### Want to give someone access?
- Go to Team tab → Invite Member
- They'll be added with chosen role
- They'll see workspace in their personal workspace list

### Want to see who has access where?
- Each workspace shows all members in Team tab
- Look for their role (Owner/Admin/Employee)

## FAQ

**Q: Can guests create tasks?**
A: No, only workspace members can create/modify content.

**Q: Can I mention someone who's not in the workspace?**
A: Yes! They'll be mentioned and can see the context. Use `○` indicators to know who's external.

**Q: What if I switch to a workspace as a guest?**
A: You'll see all projects and tasks but won't be able to edit or create anything. Features will be read-only.

**Q: How do I become a member of a workspace I can see?**
A: Request an invite from the workspace owner/admin in the Team tab.

**Q: Can a guest see team performance analytics?**
A: No, that's admin-only feature. Analytics section shows "Only workspace admins or owners can view team performance."

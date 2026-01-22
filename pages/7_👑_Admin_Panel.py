import streamlit as st
from src.database import DreamShiftDB
import datetime
import pandas as pd

st.set_page_config(page_title="Admin Panel | DreamShift EMS", page_icon="static/icons/admin.svg", layout="wide", initial_sidebar_state="expanded")

# Load UI utilities
from src.ui import load_global_css, hide_streamlit_sidebar, render_custom_sidebar

# Hide default sidebar navigation and show custom sidebar
hide_streamlit_sidebar()
render_custom_sidebar()

# Load global CSS
load_global_css()

db = DreamShiftDB()

# Check authentication and authorization
if "user_email" not in st.session_state:
    st.error("Please login first")
    st.stop()

if "user_role" not in st.session_state or st.session_state.user_role not in ["Owner", "Workspace Admin"]:
    st.error("🔒 Access Denied: This page is only available to Owners and Workspace Admins")
    st.stop()

st.markdown("""
    <h1 style="color: #f6b900;">👑 Admin Dashboard & Analytics</h1>
    <p style="color: rgba(255, 255, 255, 0.7); margin-bottom: 30px;">Manage your team, monitor performance, and view insights</p>
""", unsafe_allow_html=True)

# Get workspace info
if "current_ws_id" not in st.session_state:
    st.warning("Please select a workspace first")
    st.stop()

workspace = db.get_workspace(st.session_state.current_ws_id)
ws_stats = db.get_workspace_stats(st.session_state.current_ws_id)

# Overview Metrics
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">👥 TEAM MEMBERS</div>
            <div class="metric-value">{len(workspace.get('members', []))}</div>
        </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">📁 ACTIVE PROJECTS</div>
            <div class="metric-value">{ws_stats['total_projects']}</div>
        </div>
    """, unsafe_allow_html=True)

with col3:
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">📋 TOTAL TASKS</div>
            <div class="metric-value">{ws_stats['total_tasks']}</div>
        </div>
    """, unsafe_allow_html=True)

with col4:
    completion_rate = round((ws_stats['completed_tasks'] / ws_stats['total_tasks'] * 100) if ws_stats['total_tasks'] > 0 else 0)
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">✅ COMPLETION</div>
            <div class="metric-value">{completion_rate}%</div>
        </div>
    """, unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# Tabs
tab1, tab2, tab3, tab4, tab5 = st.tabs(["📊 Overview", "👥 Team Performance", "⚠️ Alerts", "📈 Reports", "⚙️ Admin Actions"])

with tab1:
    st.markdown("### Workspace Overview")
    
    # Task distribution
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("""
            <div class="custom-card">
                <h4 style="color: #f6b900;">Task Status Distribution</h4>
            </div>
        """, unsafe_allow_html=True)
        
        status_data = {
            'Status': ['To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'],
            'Count': [
                ws_stats['todo_tasks'],
                ws_stats['in_progress_tasks'],
                ws_stats.get('in_review_tasks', 0),
                ws_stats.get('blocked_tasks', 0),
                ws_stats['completed_tasks']
            ]
        }
        
        df_status = pd.DataFrame(status_data)
        st.bar_chart(df_status.set_index('Status'))
    
    with col2:
        st.markdown("""
            <div class="custom-card">
                <h4 style="color: #f6b900;">Project Status</h4>
            </div>
        """, unsafe_allow_html=True)
        
        projects = db.get_projects(st.session_state.current_ws_id)
        if projects:
            for project in projects[:5]:  # Show top 5
                proj_stats = db.get_project_stats(str(project['_id']))
                progress = round((proj_stats['completed_tasks'] / proj_stats['total_tasks'] * 100) if proj_stats['total_tasks'] > 0 else 0)
                
                st.markdown(f"""
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="color: #ffffff;">{project['name']}</span>
                            <span style="color: #f6b900;">{progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: {progress}%;"></div>
                        </div>
                    </div>
                """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Recent activity
    st.markdown("### 📊 Recent Activity")
    
    all_tasks = db.get_tasks_with_urgency({"workspace_id": st.session_state.current_ws_id})
    recent_tasks = sorted(all_tasks, key=lambda x: x.get('updated_at', x['created_at']), reverse=True)[:10]
    
    for task in recent_tasks:
        st.markdown(f"""
            <div class="custom-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0; color: #f6b900;">{task['title']}</h4>
                        <p style="margin: 5px 0 0 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">
                            👤 {task.get('assignee', 'Unassigned')} • 
                            📁 {task.get('project_name', 'No Project')} • 
                            {task.get('updated_at', task['created_at']).strftime('%b %d, %I:%M %p')}
                        </p>
                    </div>
                    <span class="badge badge-{'success' if task['status'] == 'Completed' else 'primary'}">
                        {task['status']}
                    </span>
                </div>
            </div>
        """, unsafe_allow_html=True)

with tab2:
    st.markdown("### 👥 Team Performance Analytics")
    
    # Get all members
    members = workspace.get('members', [])
    
    if not members:
        st.info("No team members to display")
    else:
        # Employee selector
        member_emails = [m['email'] for m in members]
        member_map = {db.get_user(email)['name']: email for email in member_emails if db.get_user(email)}
        
        selected_member_name = st.selectbox("Select Team Member", list(member_map.keys()))
        selected_member_email = member_map[selected_member_name]
        
        # Get performance data
        perf_data = db.get_employee_performance(selected_member_email, st.session_state.current_ws_id)
        
        # Display metrics
        st.markdown(f"""
            <div class="custom-card">
                <h3 style="color: #f6b900;">{perf_data['name']}'s Performance Dashboard</h3>
            </div>
        """, unsafe_allow_html=True)
        
        metric_col1, metric_col2, metric_col3, metric_col4 = st.columns(4)
        
        with metric_col1:
            st.metric("Tasks Assigned", perf_data['assigned'])
        with metric_col2:
            st.metric("Completed", perf_data['completed'])
        with metric_col3:
            st.metric("Completion Rate", f"{perf_data['completion_rate']}%")
        with metric_col4:
            st.metric("Avg. Time to Complete", f"{perf_data['avg_completion_time_days']} days")
        
        st.markdown("---")
        
        # Current tasks
        st.markdown("#### Current Tasks")
        
        member_tasks = db.get_tasks_with_urgency({"assignee": selected_member_email, "workspace_id": st.session_state.current_ws_id})
        active_tasks = [t for t in member_tasks if t['status'] != 'Completed']
        
        if not active_tasks:
            st.success("✨ All tasks completed!")
        else:
            for task in active_tasks:
                st.markdown(f"""
                    <div class="task-card" style="border-left-color: {task['urgency_color']};">
                        <h4 style="margin: 0; color: #ffffff;">{task['title']}</h4>
                        <p style="margin: 5px 0 0 0; color: rgba(255, 255, 255, 0.7);">
                            📅 Due: {task['due_date'].strftime('%b %d, %Y')} • 
                            📊 {task['completion_pct']}% Complete • 
                            🎯 {task.get('priority', 'Normal')}
                        </p>
                    </div>
                """, unsafe_allow_html=True)
        
        st.markdown("---")
        
        # Time tracking summary
        st.markdown("#### ⏱️ Time Tracking Summary")
        
        time_entries = db.get_user_time_entries(selected_member_email)
        
        if time_entries:
            # Calculate weekly time
            week_start = datetime.datetime.utcnow() - datetime.timedelta(days=datetime.datetime.utcnow().weekday())
            week_time = sum(
                entry['duration'] for entry in time_entries 
                if entry['timestamp'] >= week_start
            ) / 3600  # Convert to hours
            
            col1, col2 = st.columns(2)
            with col1:
                st.metric("This Week", f"{round(week_time, 1)}h")
            with col2:
                total_time = sum(entry['duration'] for entry in time_entries) / 3600
                st.metric("All Time", f"{round(total_time, 1)}h")
        else:
            st.info("No time entries logged yet")
        
        # Share access option (Owner only)
        if st.session_state.user_role == "Owner":
            st.markdown("---")
            st.markdown("#### 🔓 Share Dashboard Access")
            
            st.info("💡 You can grant view-only access to this employee's dashboard to other team members")
            
            share_email = st.text_input("Share with (email)", placeholder="colleague@company.com")
            if st.button("Grant View Access"):
                if share_email:
                    st.success(f"✅ Dashboard access granted to {share_email}")
                else:
                    st.error("Please enter an email address")

with tab3:
    st.markdown("### ⚠️ Alerts & Notifications")
    
    # Overdue tasks
    st.markdown("#### 🚨 Overdue Tasks")
    
    all_tasks = db.get_tasks_with_urgency({"workspace_id": st.session_state.current_ws_id})
    overdue_tasks = [
        t for t in all_tasks 
        if t.get('due_date') and t['due_date'] < datetime.datetime.utcnow() and t['status'] != 'Completed'
    ]
    
    if overdue_tasks:
        st.warning(f"⚠️ {len(overdue_tasks)} overdue tasks require attention!")
        for task in overdue_tasks:
            days_overdue = (datetime.datetime.utcnow() - task['due_date']).days
            st.markdown(f"""
                <div class="task-card task-card-urgent">
                    <h4 style="margin: 0; color: #ff4444;">{task['title']}</h4>
                    <p style="margin: 5px 0 0 0; color: rgba(255, 255, 255, 0.7);">
                        👤 {task.get('assignee', 'Unassigned')} • 
                        ⏰ {days_overdue} days overdue • 
                        📁 {task.get('project_name', 'No Project')}
                    </p>
                </div>
            """, unsafe_allow_html=True)
    else:
        st.success("✅ No overdue tasks!")
    
    st.markdown("---")
    
    # Contract expiry warnings
    st.markdown("#### 📄 Contract Expiry Alerts")
    
    expiring_soon = []
    for member in members:
        user = db.get_user(member['email'])
        if user and user.get('contract_expiry'):
            expiry_date = user['contract_expiry']
            days_until_expiry = (expiry_date - datetime.datetime.utcnow()).days
            
            if 0 <= days_until_expiry <= 30:
                expiring_soon.append({
                    'name': user['name'],
                    'email': user['email'],
                    'days': days_until_expiry,
                    'date': expiry_date
                })
    
    if expiring_soon:
        for contract in expiring_soon:
            st.warning(f"""
                ⚠️ **{contract['name']}**'s contract expires in {contract['days']} days 
                ({contract['date'].strftime('%B %d, %Y')})
            """)
    else:
        st.success("✅ No contracts expiring in the next 30 days")
    
    st.markdown("---")
    
    # Extension requests
    st.markdown("#### 🕒 Pending Extension Requests")
    
    extension_requests = db.get_extension_requests(st.session_state.current_ws_id, status="Pending")
    
    if extension_requests:
        for req in extension_requests:
            task = db.get_task(req['task_id'])
            if task:
                st.markdown(f"""
                    <div class="custom-card">
                        <h4 style="color: #f6b900;">{task['title']}</h4>
                        <p style="color: rgba(255, 255, 255, 0.7);">
                            Requested by: {req['requested_by']}<br>
                            Current deadline: {task['due_date'].strftime('%B %d, %Y')}<br>
                            Requested new deadline: {req['new_deadline'].strftime('%B %d, %Y')}<br>
                            Reason: {req.get('reason', 'Not provided')}
                        </p>
                    </div>
                """, unsafe_allow_html=True)
                
                col1, col2 = st.columns(2)
                with col1:
                    if st.button("✅ Approve", key=f"approve_{req['_id']}", use_container_width=True):
                        db.approve_extension_request(str(req['_id']))
                        st.success("Extension approved!")
                        st.rerun()
                with col2:
                    if st.button("❌ Reject", key=f"reject_{req['_id']}", use_container_width=True):
                        db.reject_extension_request(str(req['_id']))
                        st.success("Extension rejected")
                        st.rerun()
    else:
        st.info("No pending extension requests")

with tab4:
    st.markdown("### 📈 Reports & Analytics")
    
    st.markdown("""
        <div class="custom-card">
            <h4 style="color: #f6b900;">Generate Reports</h4>
            <p style="color: rgba(255, 255, 255, 0.7);">Export data and create custom reports</p>
        </div>
    """, unsafe_allow_html=True)
    
    report_type = st.selectbox("Report Type", [
        "Workspace Summary",
        "Team Performance",
        "Project Status",
        "Time Tracking",
        "Task Completion"
    ])
    
    date_col1, date_col2 = st.columns(2)
    with date_col1:
        start_date = st.date_input("From", value=datetime.date.today() - datetime.timedelta(days=30))
    with date_col2:
        end_date = st.date_input("To", value=datetime.date.today())
    
    if st.button("📊 Generate Report", use_container_width=True):
        st.success("✅ Report generated!")

        # Build CSV for tasks in range (workspace scoped)
        tasks = db.get_tasks_with_urgency({"workspace_id": ws_id})
        rows = [
            [
                t.get("title", ""),
                t.get("status", ""),
                t.get("priority", ""),
                t.get("assignee", ""),
                t.get("project_name", ""),
                (t.get("due_date") or datetime.datetime.min).strftime("%Y-%m-%d"),
            ]
            for t in tasks
            if t.get("due_date") and start_date <= t["due_date"].date() <= end_date
        ]
        header = ["Title", "Status", "Priority", "Assignee", "Project", "Due Date"]

        import io, csv

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(header)
        writer.writerows(rows)
        csv_bytes = buf.getvalue().encode("utf-8")

        st.download_button(
            label="💾 Download CSV",
            data=csv_bytes,
            file_name="dreamshift_report.csv",
            mime="text/csv",
            use_container_width=True,
        )
        
        # Show preview based on report type
        if report_type == "Workspace Summary":
            st.markdown("#### Workspace Summary Report")
            st.write(f"**Period:** {start_date} to {end_date}")
            st.write(f"**Total Projects:** {ws_stats['total_projects']}")
            st.write(f"**Total Tasks:** {ws_stats['total_tasks']}")
            st.write(f"**Completed:** {ws_stats['completed_tasks']}")
            st.write(f"**Completion Rate:** {completion_rate}%")

with tab5:
    st.markdown("### ⚙️ Admin Actions")
    
    if st.session_state.user_role == "Owner":
        # User Profile Management Section
        st.markdown("""
            <div class="custom-card">
                <h4 style="color: #f6b900;">👤 User Profile Management</h4>
                <p style="color: rgba(255, 255, 255, 0.7);">Manage team member profiles, photos, roles, and join dates</p>
            </div>
        """, unsafe_allow_html=True)
        
        members = workspace.get("members", [])
        member_emails = [m["email"] for m in members if m.get("email")]
        # Get ALL users from database instead of just workspace members
        all_users = db.get_all_users_for_mentions()
        users = all_users if all_users else []
        
        if users:
            name_to_email = {u["name"]: u["email"] for u in users}
            selected_name = st.selectbox("Select user to manage", list(name_to_email.keys()))
            selected_email = name_to_email[selected_name]
            selected_user = db.get_user(selected_email)
            selected_profile = selected_user.get("profile", {})
            
            st.markdown('<div class="custom-card" style="padding:18px;">', unsafe_allow_html=True)
            
            with st.form("admin_update_user_profile"):
                st.write(f"**Editing:** {selected_user['name']} ({selected_user['email']})")
                st.markdown("---")
                
                new_name = st.text_input("Full name", value=selected_user.get("name", ""))
                role_title = st.text_input("Current role / job title", value=selected_profile.get("role_title", ""), 
                                          help="e.g., Senior CV Writer, Project Manager")
                photo_url = st.text_input("Profile photo URL (LinkedIn or public URL)", 
                                         value=selected_profile.get("photo_url", ""),
                                         help="Paste a publicly accessible image URL. Note: LinkedIn URLs may expire.")
                
                # Date joined
                existing_joined = selected_profile.get("date_joined", None)
                default_joined = datetime.date.today()
                try:
                    if isinstance(existing_joined, datetime.datetime):
                        default_joined = existing_joined.date()
                    elif isinstance(existing_joined, datetime.date):
                        default_joined = existing_joined
                    elif isinstance(existing_joined, str) and existing_joined:
                        default_joined = datetime.date.fromisoformat(existing_joined[:10])
                except:
                    default_joined = datetime.date.today()
                
                date_joined = st.date_input("Employment start date", value=default_joined,
                                           help="The date this employee joined your organization")
                
                # Preview
                st.markdown("#### Preview")
                preview_col1, preview_col2 = st.columns([1, 3])
                with preview_col1:
                    if photo_url:
                        try:
                            st.image(photo_url, width=90)
                        except:
                            st.warning("⚠️ Image failed to load. URL may be invalid or expired.")
                    else:
                        st.info("No photo URL provided")
                
                with preview_col2:
                    st.markdown(f"""
                        <div style="padding:10px;">
                            <div style="font-size:16px; font-weight:700; color:#ffffff;">{new_name}</div>
                            <div style="color:rgba(255,255,255,0.70); margin-top:4px;">{role_title or "No role set"}</div>
                            <div style="color:rgba(255,255,255,0.55); font-size:12px; margin-top:4px;">
                                Joined: {date_joined.strftime("%b %d, %Y")}
                            </div>
                        </div>
                    """, unsafe_allow_html=True)
                
                st.markdown("---")
                col_btn, col_spacer = st.columns([1, 8])
                with col_btn:
                    save = st.form_submit_button("💾 Save User Profile", use_container_width=True, type="primary")
                
                if save:
                    db.update_user_profile_fields(selected_email, {
                        "name": new_name,
                        "profile.role_title": role_title,
                        "profile.photo_url": photo_url,
                        "profile.date_joined": date_joined.isoformat()
                    })
                    st.success("✅ User profile updated successfully!")
                    st.rerun()
            
            st.markdown("</div>", unsafe_allow_html=True)
        else:
            st.info("No team members found in this workspace.")
        
        st.markdown("---")
        
        # Workspace Management
        st.markdown("""
            <div class="custom-card">
                <h4 style="color: #f6b900;">Workspace Management</h4>
                <p style="color: rgba(255, 255, 255, 0.7);">Advanced administrative controls</p>
            </div>
        """, unsafe_allow_html=True)
        
        # Bulk actions
        st.markdown("#### 🔄 Bulk Operations")
        
        bulk_action = st.selectbox("Select Action", [
            "Mark all overdue tasks as urgent",
            "Send reminder to all team members",
            "Archive completed projects",
            "Export all data"
        ])
        
        if st.button("Execute Bulk Action"):
            st.warning("⚠️ Are you sure? This will affect multiple items.")
            if st.button("Confirm"):
                st.success("✅ Bulk action completed!")
        
        st.markdown("---")
        
        # Workspace settings
        st.markdown("#### ⚙️ Workspace Settings")
        
        if st.button("🏢 Manage Workspace"):
            st.switch_page("pages/1_🏢_Workspaces.py")
        
        if st.button("👥 Manage Team Members"):
            st.switch_page("pages/1_🏢_Workspaces.py")
    else:
        st.info("🔒 Owner-only section. Contact your workspace owner for administrative actions.")

# Footer
st.markdown("---")
st.markdown("""
    <div style="text-align: center; color: rgba(255, 255, 255, 0.7);">
        <p>💡 Admin Panel • Manage your team efficiently • DreamShift EMS</p>
    </div>
""", unsafe_allow_html=True)
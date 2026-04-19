"use client";

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Search, Bell, Menu, ChevronDown, Settings, LogOut, Briefcase, Calendar as CalendarIcon, CheckSquare, Activity, User as UserIcon } from 'lucide-react';
import NotificationsPanel from '@/components/ui/NotificationsPanel';
import Link from 'next/link';
import './Topbar.css';

export default function Topbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  const userInitials = session?.user?.name 
    ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : 'U';

  // Dynamic Breadcrumbs based on pathname
  const generateBreadcrumbs = () => {
     const paths = pathname.split('/').filter(Boolean);
     if (paths.length === 0) return [{ label: 'Home Dashboard' }];
     
     const breadcrumbs = [{ label: 'Home' }];
     paths.forEach((p) => {
        // Map common routes nicely
        if (p === 'tasks') breadcrumbs.push({ label: 'All Tasks' });
        else if (p === 'projects') breadcrumbs.push({ label: 'Projects' });
        else if (p === 'calendar') breadcrumbs.push({ label: 'Calendar' });
        else if (p === 'analytics') breadcrumbs.push({ label: 'Workspace Analytics' });
        else if (p === 'profile') breadcrumbs.push({ label: 'User Profile' });
        else breadcrumbs.push({ label: `ID: ${p.substring(0,6)}...` }); // For IDs like /projects/[id]
     });
     
     return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <div className="flex flex-col w-full z-40 border-b border-white/5 relative">
       {/* MAIN TOP NAVIGATION BAR */}
       <header className="topbar glass px-6 py-3 flex items-center justify-between">
         <div className="flex items-center gap-6">
           <button className="mobile-menu-btn hidden sm:block p-2 text-muted hover:text-white transition cursor-pointer">
             <Menu size={20} />
           </button>
           
           <div className="hidden md:flex items-center gap-4">
              {/* Workspace Dropdown */}
              <div className="relative">
                 <button onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)} className="nav-dropdown-btn">
                    <Briefcase size={16} /> DreamShift Workspace <ChevronDown size={14} />
                 </button>
                 {showWorkspaceMenu && (
                    <div className="absolute top-full left-0 mt-2 w-48 glass rounded-xl border border-white/10 py-2 shadow-2xl z-50">
                       <div className="px-4 py-2 text-xs text-muted font-bold uppercase tracking-wider">Active Workspace</div>
                       <div className="px-4 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2 border-l-2 border-[#4361ee] bg-white/5"><Briefcase size={14}/> DreamShift Inc</div>
                    </div>
                 )}
              </div>

              {/* Projects Dropdown */}
              <div className="relative">
                 <button onClick={() => setShowProjectMenu(!showProjectMenu)} className="nav-dropdown-btn">
                    Projects <ChevronDown size={14} />
                 </button>
                 {showProjectMenu && (
                    <div className="absolute top-full left-0 mt-2 w-48 glass rounded-xl border border-white/10 py-2 shadow-2xl z-50">
                       <div className="px-4 py-2 text-xs text-muted font-bold uppercase tracking-wider">Recent</div>
                       <Link href="/projects" className="px-4 py-2 hover:bg-white/5 cursor-pointer block">View All Projects</Link>
                    </div>
                 )}
              </div>

              {/* Top Links */}
              <Link href="/tasks" className="nav-link"><CheckSquare size={16} /> All Tasks</Link>
              <Link href="/calendar" className="nav-link"><CalendarIcon size={16} /> Calendar</Link>
              <Link href="/analytics" className="nav-link"><Activity size={16} /> Reports</Link>
           </div>
         </div>
         
         <div className="flex items-center gap-4">
           <div className="search-container hidden lg:flex items-center relative">
             <Search className="absolute left-3 text-muted" size={16} />
             <input type="text" placeholder="Search tasks, projects..." className="search-input w-64 bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-sm text-white focus:border-[#4361ee] outline-none transition" />
             <div className="absolute right-3 text-muted text-xs border border-white/10 px-1.5 rounded">⌘K</div>
           </div>
           
           <div className="relative">
             <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-muted hover:text-white transition relative">
               <Bell size={20} />
               <span className="absolute top-1 right-2 w-2 h-2 bg-danger rounded-full"></span>
             </button>
             {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}
           </div>
           
           <div className="relative">
             <div 
               className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7b2cbf] to-[#4361ee] text-white flex items-center justify-center font-bold text-xs cursor-pointer shadow-lg border border-white/20"
               onClick={() => setShowProfileMenu(!showProfileMenu)}
             >
                {userInitials}
             </div>
             
             {showProfileMenu && (
                <div className="absolute top-full right-0 mt-2 w-56 glass rounded-xl border border-white/10 py-2 shadow-2xl z-50">
                   <div className="px-4 py-3 border-b border-white/10 mb-2">
                      <p className="text-sm font-bold text-white">{session?.user?.name}</p>
                      <p className="text-xs text-muted">{session?.user?.email}</p>
                   </div>
                   <Link href="/profile" className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 cursor-pointer text-sm mb-1 text-white"><UserIcon size={16}/> Profile & Settings</Link>
                   <div className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 cursor-pointer text-sm mb-1 text-white"><Settings size={16}/> Account Preferences</div>
                   <div className="border-t border-white/10 mt-2 pt-2">
                     <button onClick={() => signOut()} className="flex items-center gap-3 px-4 py-2 hover:bg-danger/10 text-danger cursor-pointer text-sm w-full transition-colors"><LogOut size={16}/> Sign Out</button>
                   </div>
                </div>
             )}
           </div>
         </div>
       </header>

       {/* BREADCRUMBS TRAIL */}
       <div className="w-full bg-[#1e1e1f] px-6 py-2 flex items-center text-xs text-muted overflow-hidden whitespace-nowrap">
          {breadcrumbs.map((crumb, index) => (
             <React.Fragment key={crumb.label}>
                <span className={index === breadcrumbs.length - 1 ? 'text-white font-medium pl-2' : 'pl-2'}>
                   {crumb.label}
                </span>
                {index < breadcrumbs.length - 1 && <span className="mx-2 text-white/20">/</span>}
             </React.Fragment>
          ))}
       </div>
    </div>
  );
}

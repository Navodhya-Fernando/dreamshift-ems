"use client";
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, FolderOpen, CheckSquare, Calendar, BarChart2, Clock, MessageCircle, Settings, User, LogOut, ChevronRight, Zap, Shield, FileStack } from 'lucide-react';
import { normalizePlatformRole } from '@/lib/roles';
import './Sidebar.css';
const groups = [
  { label: 'My work', items: [
    { label: 'Home', path: '/', icon: Home },
    { label: 'My Tasks', path: '/tasks', icon: CheckSquare },
    { label: 'Calendar', path: '/calendar', icon: Calendar },
    { label: 'Time Tracking', path: '/time', icon: Clock },
  ] },
  { label: 'Team', items: [
    { label: 'Workspaces', path: '/projects', icon: FolderOpen },
    { label: 'Messages', path: '/messages', icon: MessageCircle },
    { label: 'Templates', path: '/task-templates', icon: FileStack },
  ] },
  { label: 'Insights & management', items: [
    { label: 'Analytics', path: '/analytics', icon: BarChart2 },
    { label: 'Administration', path: '/admin', icon: Shield },
  ] },
];
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const canAccessAdmin = Boolean(session?.user?.role && ['OWNER','ADMIN','WORKSPACE_ADMIN'].includes(normalizePlatformRole(session.user.role)));
  const initials = session?.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || 'U';
  const isActive = (path: string) => path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');
  const close = () => { setShowUserMenu(false); onNavigate?.(); };
  return <aside className="sidebar" id="ems-navigation">
    <Link href="/" onClick={close} className="sidebar-logo"><div className="sidebar-logo-icon"><Zap size={16} color="white" strokeWidth={2.5}/></div><div><div className="sidebar-logo-text">DreamShift</div><div className="sidebar-logo-sub">EMS</div></div></Link>
    <nav className="sidebar-nav" aria-label="Main navigation">
      {groups.map(group => <div className="nav-group" key={group.label}><div className="nav-section-label">{group.label}</div>{group.items.filter(item => item.path !== '/admin' || canAccessAdmin).map(({label,path,icon: Icon}) => <Link key={path} href={path} onClick={close} aria-current={isActive(path) ? 'page' : undefined} className={`nav-link ${isActive(path) ? 'active' : ''}`}><Icon size={17} strokeWidth={1.8}/>{label}</Link>)}</div>)}
    </nav>
    <div className="sidebar-user">
      {showUserMenu && <div className="user-menu"><Link href="/profile" className="user-menu-item" onClick={close}><User size={15}/> Profile & Stats</Link><Link href="/settings" className="user-menu-item" onClick={close}><Settings size={15}/> Settings</Link><div className="user-menu-divider"/><button className="user-menu-item danger" onClick={() => signOut()}><LogOut size={15}/> Sign out</button></div>}
      <button className="user-card w-full" aria-expanded={showUserMenu} onClick={() => setShowUserMenu(v => !v)}><div className="user-avatar">{initials}</div><div className="user-info"><div className="user-name">{session?.user?.name || 'User'}</div><div className="user-email">{session?.user?.email || ''}</div></div><ChevronRight size={14}/></button>
    </div>
  </aside>;
}

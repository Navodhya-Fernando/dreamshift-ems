"use client";
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TimerProvider from './TimerProvider';
import ShellTopbar from './ShellTopbar';
import ToastViewport from '@/components/ui/ToastViewport';
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith('/auth')) return <>{children}</>;
  return <TimerProvider><div className={`app-container ${open ? 'nav-open' : ''}`} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
    {open && <button className="shell-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <Sidebar onNavigate={() => setOpen(false)} />
    <div className="main-content"><ShellTopbar onToggleNav={() => setOpen(v => !v)} navOpen={open} />{children}</div>
    <ToastViewport />
  </div></TimerProvider>;
}

"use client";
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import ShellTopbar from './ShellTopbar';
import ToastViewport from '@/components/ui/ToastViewport';

const AUTH_PATHS = ['/auth'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = AUTH_PATHS.some(p => pathname.startsWith(p));

  if (hideNav) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <ShellTopbar />
        {children}
      </div>
      <ToastViewport />
    </div>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import AuthProvider from "@/components/AuthProvider";


export const metadata: Metadata = {
  title: "DreamShift EMS",
  description: "Professional Project & Employee Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          <AppShell>
            {children}
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}

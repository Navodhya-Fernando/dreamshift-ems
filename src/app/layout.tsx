import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import AuthProvider from "@/components/AuthProvider";
import RegisterServiceWorker from "@/components/layout/RegisterServiceWorker";


export const metadata: Metadata = {
  title: "DreamShift EMS",
  description: "Professional Project & Employee Management",
  manifest: "/manifest.webmanifest",
  icons: { apple: [{url:"/app-icons/180",sizes:"180x180",type:"image/png"}], icon:[{url:"/app-icons/192",sizes:"192x192",type:"image/png"}] },
  appleWebApp: { capable:true, title:"DreamShift EMS", statusBarStyle:"default" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <RegisterServiceWorker />
        <AuthProvider>
          <AppShell>
            {children}
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Auth pages use their own layout — no sidebar needed.
  // globals.css is already imported by the root layout.
  return <>{children}</>;
}

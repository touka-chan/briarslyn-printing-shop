import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthGateLoader } from "@/components/auth/AuthGateLoader";
import { SessionTimeoutWatcher } from "@/components/auth/SessionTimeoutWatcher";

export const metadata: Metadata = {
  title: "Briarslyn Printing Shop",
  description: "Briarslyn Printing Shop Management System",
};

/**
 * No-flash dark-mode bootstrap. Runs SYNCHRONOUSLY in <head> before the
 * browser paints anything, so a user who picked dark mode never sees a
 * white flash when they navigate to a new page (Next renders a fresh
 * <html> on each route and the React effect that adds `.dark` would
 * otherwise land AFTER first paint).
 *
 * The script mirrors Header.tsx's applyTheme() — same key
 * ("printflow-theme"), same class name ("dark"), same fallback to the
 * OS preference via matchMedia. If the value is "light" we leave the
 * <html> alone (no class) and let the dark CSS block stay inactive.
 *
 * `dangerouslySetInnerHTML` is intentional — Next would otherwise
 * escape the script body. The string is static; no user input flows
 * through it.
 */
const themeScript = `(function(){try{var s=localStorage.getItem('printflow-theme');var d=s==='dark'||(!s&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AuthGateLoader>{children}</AuthGateLoader>
          {/*
            SessionTimeoutWatcher renders no visible UI of its own;
            it lives in the root layout so it can mount the warning
            modal and trigger auto-logout regardless of which page
            the user is on. It must be inside <ToastProvider> so the
            "session expired" toast has somewhere to land.
          */}
          <SessionTimeoutWatcher />
        </ToastProvider>
      </body>
    </html>
  );
}

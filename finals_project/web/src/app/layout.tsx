import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthGateLoader } from "@/components/auth/AuthGateLoader";
import { SessionTimeoutWatcher } from "@/components/auth/SessionTimeoutWatcher";

/**
 * Display face (Poppins Bold) shared by headings/KPI values via the
 * `.font-display` utility. Self-hosted at build time - no runtime CDN.
 */
const displayFont = Poppins({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "Brialyns Art Sign",
    template: "%s | Brialyns Art Sign",
  },
  description: "Brialyns Art Sign Management System",
  icons: [{ rel: "icon", url: "/logo.jpg" }],
};

/**
 * No-flash dark-mode bootstrap. Runs SYNCHRONOUSLY in <head> before the
 * browser paints anything, so a user who picked dark mode never sees a
 * white flash when they navigate to a new page (Next renders a fresh
 * <html> on each route and the React effect that adds `.dark` would
 * otherwise land AFTER first paint).
 *
 * The script mirrors Header.tsx's applyTheme() - same key
 * ("printflow-theme"). Default is ALWAYS light: dark mode applies only
 * when the user explicitly chose it (stored "dark"). The OS color
 * scheme is deliberately ignored so a dark-mode OS never forces the
 * admin panel dark on first visit.
 *
 * `dangerouslySetInnerHTML` is intentional - Next would otherwise
 * escape the script body. The string is static; no user input flows
 * through it.
 */
const themeScript = `(function(){try{var s=localStorage.getItem('printflow-theme');if(s==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${displayFont.variable}`} suppressHydrationWarning>
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

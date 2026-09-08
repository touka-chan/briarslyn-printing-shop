"use client";

import { useState, useEffect } from "react";
import {
 Save,
 Bell,
 Shield,
 Palette,
 Database,
 Key,
 Moon,
 Sun,
 Monitor,
 Settings,
 Plus,
 ShoppingBag,
 MessageSquare,
 HardDrive,
} from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, Button, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const settingsSections = [
 { id: "general", label: "General", icon: <Settings className="w-5 h-5" /> },
 { id: "appearance", label: "Appearance", icon: <Palette className="w-5 h-5" /> },
 { id: "notifications", label: "Notifications", icon: <Bell className="w-5 h-5" /> },
 { id: "security", label: "Security", icon: <Shield className="w-5 h-5" /> },
 { id: "integrations", label: "Integrations", icon: <Database className="w-5 h-5" /> },
 { id: "api", label: "API Keys", icon: <Key className="w-5 h-5" /> },
];

const STORAGE_KEY = "printfow.settings";

type StoredSettings = {
 theme: "light" | "dark" | "system";
 sidebarCollapsed: boolean;
 emailNotifications: boolean;
 lowStockEmail: boolean;
 delayEmail: boolean;
 weeklySummary: boolean;
 pushNotifications: boolean;
 twoFactor: boolean;
 sessionTimeout: string;
};

const DEFAULTS: StoredSettings = {
 theme: "light",
 sidebarCollapsed: false,
 emailNotifications: true,
 lowStockEmail: true,
 delayEmail: true,
 weeklySummary: false,
 pushNotifications: false,
 twoFactor: false,
 sessionTimeout: "30",
};

function formatSettingsDate(v: unknown): string {
 if (!v) return "";
 const d =
  v instanceof Date
   ? v
   : typeof v === "string"
   ? new Date(v)
   : typeof v === "object" && v && "toDate" in v
   ? (v as { toDate: () => Date }).toDate()
   : null;
 if (!d || isNaN(d.getTime())) return "";
 return d.toLocaleString("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
 });
}

export default function SettingsPage() {
 const [activeSection, setActiveSection] = useState("general");
 const [s, setS] = useState<StoredSettings>(DEFAULTS);
 const [hydrated, setHydrated] = useState(false);
 const toast = useToast();
 const { user: currentUser } = useAuth();
 const adminUser = currentUser;

 // Hydrate from localStorage
 useEffect(() => {
  try {
   const raw = window.localStorage.getItem(STORAGE_KEY);
   if (raw) {
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    setS((prev) => ({ ...prev, ...parsed }));
   }
  } catch {
   /* ignore */
  }
  setHydrated(true);
 }, []);

 // Persist + sync theme
 useEffect(() => {
  if (!hydrated) return;
  try {
   window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
   /* ignore */
  }
  if (typeof document !== "undefined") {
   const root = document.documentElement;
   if (s.theme === "dark") root.classList.add("dark");
   else if (s.theme === "light") root.classList.remove("dark");
   else {
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefers);
   }
   try {
    window.localStorage.setItem("printflow-theme", s.theme);
   } catch {
    /* ignore */
   }
  }
 }, [s, hydrated]);

 const update = <K extends keyof StoredSettings>(k: K, v: StoredSettings[K]) =>
  setS((prev) => ({ ...prev, [k]: v }));

 const handleSave = (section: string) => {
  toast.success(`${section} settings saved`);
 };

 const inputCls =
  "w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent";
 const labelCls =
  "block text-sm font-medium text-printflow-on-surface-variant mb-1";

 return (
  <AdminLayout title="Settings" subtitle="Configure your PrintFlow workspace preferences">
   <div className="flex flex-col lg:flex-row gap-8">
    {/* Settings Sidebar */}
    <aside className="w-full lg:w-56 flex-shrink-0">
     <nav
      className="bg-printflow-surface rounded-xl border border-printflow-outline-variant p-4"
      aria-label="Settings navigation"
     >
      <ul className="space-y-1" role="list">
       {settingsSections.map((section) => (
        <li key={section.id}>
         <button
          onClick={() => setActiveSection(section.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
           activeSection === section.id
            ? "bg-printflow-primary text-printflow-on-primary"
            : "text-printflow-on-surface-variant hover:bg-printflow-surface-container hover:text-printflow-on-surface"
          }`}
          aria-current={activeSection === section.id ? "page" : undefined}
         >
          {section.icon}
          {section.label}
         </button>
        </li>
       ))}
      </ul>
     </nav>
    </aside>

    {/* Settings Content */}
    <div className="flex-1 min-w-0">
     {/* General Settings */}
     {activeSection === "general" && (
      <>
       <ContentCard
        title="Profile"
        subtitle="Read-only · signed in via Firebase Auth"
       >
        <div className="flex items-center gap-4 p-4 bg-printflow-surface-container/50 rounded-xl border border-printflow-outline-variant/40">
         <div className="w-14 h-14 rounded-xl bg-printflow-primary-fixed flex items-center justify-center font-bold text-printflow-primary text-lg shrink-0">
          {adminUser?.name
           .split(" ")
           .map((n) => n[0])
           .join("")
           .slice(0, 2) ?? "U"}
         </div>
         <div className="min-w-0 flex-1">
          <p className="font-semibold text-printflow-on-surface leading-tight truncate">
           {adminUser?.name ?? "Unknown"}
          </p>
          <p className="text-[13px] text-printflow-on-surface-variant truncate">
           {adminUser?.email}
          </p>
          <p className="text-xs text-printflow-on-surface-variant/80 mt-0.5">
           {adminUser?.role}
           {adminUser?.lastLogin
            ? ` • Last login ${formatSettingsDate(adminUser.lastLogin)}`
            : ""}
          </p>
         </div>
        </div>
       </ContentCard>

       <ContentCard
        title="Company Information"
        subtitle="Basic information about your organization"
       >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div>
          <label className={labelCls}>Company Name</label>
          <input
           type="text"
           defaultValue="Brialyns Art Sign"
           className={inputCls}
          />
         </div>
         <div>
          <label className={labelCls}>Industry</label>
          <select className={inputCls}>
           <option>Printing & Signage</option>
           <option>Manufacturing</option>
           <option>Packaging</option>
           <option>Other</option>
          </select>
         </div>
         <div>
          <label className={labelCls}>Timezone</label>
          <select className={inputCls}>
           <option>UTC+08:00 Philippine Time (PHT)</option>
           <option>UTC-08:00 Pacific Time</option>
           <option>UTC-05:00 Eastern Time</option>
           <option>UTC+00:00 GMT</option>
          </select>
         </div>
         <div>
          <label className={labelCls}>Currency</label>
          <select className={inputCls}>
           <option>PHP (₱)</option>
           <option>USD ($)</option>
           <option>EUR (€)</option>
           <option>GBP (£)</option>
          </select>
         </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 border-t border-printflow-outline-variant pt-4">
         <Button
          variant="primary"
          onClick={() => handleSave("Company information")}
         >
          <Save className="w-4 h-4 mr-2" /> Save Changes
         </Button>
        </div>
       </ContentCard>

       <ContentCard
        title="Default Preferences"
        subtitle="Set default values for new orders and projects"
       >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div>
          <label className={labelCls}>Default Paper Type</label>
          <select className={inputCls}>
           <option>Premium Cardstock 350gsm</option>
           <option>Matte Coated Paper 200gsm</option>
           <option>Glossy Photo Paper 250gsm</option>
          </select>
         </div>
         <div>
          <label className={labelCls}>Default Finish</label>
          <select className={inputCls}>
           <option>None</option>
           <option>UV Coating</option>
           <option>Lamination</option>
           <option>Spot UV</option>
          </select>
         </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 border-t border-printflow-outline-variant pt-4">
         <Button variant="primary" onClick={() => handleSave("Defaults")}>
          <Save className="w-4 h-4 mr-2" /> Save Defaults
         </Button>
        </div>
       </ContentCard>
      </>
     )}

     {/* Appearance Settings */}
     {activeSection === "appearance" && (
      <>
       <ContentCard
        title="Theme"
        subtitle="Customize the look and feel of PrintFlow"
       >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {(
          [
           { id: "light", label: "Light", desc: "Clean, bright interface", icon: <Sun className="w-10 h-10 mx-auto mb-3 text-printflow-primary" /> },
           { id: "dark", label: "Dark", desc: "Easy on the eyes", icon: <Moon className="w-10 h-10 mx-auto mb-3 text-printflow-primary" /> },
           { id: "system", label: "System", desc: "Match OS preference", icon: <Monitor className="w-10 h-10 mx-auto mb-3 text-printflow-primary" /> },
          ] as const
         ).map((opt) => (
          <button
           key={opt.id}
           onClick={() => update("theme", opt.id)}
           className={`p-6 rounded-xl border-2 transition-all text-center ${
            s.theme === opt.id
             ? "border-printflow-primary bg-printflow-primary-fixed/10"
             : "border-printflow-outline-variant hover:border-printflow-primary/50"
           }`}
           aria-pressed={s.theme === opt.id}
          >
           {opt.icon}
           <h4 className="font-semibold text-printflow-on-surface mb-1">
            {opt.label}
           </h4>
           <p className="text-sm text-printflow-on-surface-variant">
            {opt.desc}
           </p>
          </button>
         ))}
        </div>
       </ContentCard>

       <ContentCard
        title="Sidebar Preferences"
        subtitle="Customize navigation behavior"
       >
        <div className="space-y-4">
         <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
           <p className="font-medium text-printflow-on-surface">
            Collapse sidebar by default
           </p>
           <p className="text-sm text-printflow-on-surface-variant">
            Start with minimized navigation
           </p>
          </div>
          <input
           type="checkbox"
           checked={s.sidebarCollapsed}
           onChange={(e) => update("sidebarCollapsed", e.target.checked)}
           className="w-5 h-5 text-printflow-primary border-printflow-outline-variant rounded focus:ring-printflow-primary"
          />
         </label>
        </div>
       </ContentCard>
      </>
     )}

     {/* Notifications Settings */}
     {activeSection === "notifications" && (
      <>
       <ContentCard
        title="Email Notifications"
        subtitle="Configure when you receive email alerts"
       >
        <div className="space-y-4">
         {(
          [
           {
            key: "emailNotifications" as const,
            title: "Order updates",
            desc: "New orders, status changes, completions",
           },
           {
            key: "lowStockEmail" as const,
            title: "Low stock alerts",
            desc: "When inventory falls below minimum levels",
           },
           {
            key: "delayEmail" as const,
            title: "Production delays",
            desc: "Jobs running behind schedule",
           },
           {
            key: "weeklySummary" as const,
            title: "Weekly summary",
            desc: "Weekly digest of operations metrics",
           },
          ]
         ).map((row) => (
          <label
           key={row.key}
           className="flex items-center justify-between gap-3 cursor-pointer"
          >
           <div>
            <p className="font-medium text-printflow-on-surface">{row.title}</p>
            <p className="text-sm text-printflow-on-surface-variant">
             {row.desc}
            </p>
           </div>
           <input
            type="checkbox"
            checked={s[row.key]}
            onChange={(e) => update(row.key, e.target.checked)}
            className="w-5 h-5 text-printflow-primary border-printflow-outline-variant rounded focus:ring-printflow-primary"
           />
          </label>
         ))}
        </div>
        <div className="flex justify-end gap-3 mt-6 border-t border-printflow-outline-variant pt-4">
         <Button
          variant="primary"
          onClick={() => handleSave("Notification preferences")}
         >
          <Save className="w-4 h-4 mr-2" /> Save Preferences
         </Button>
        </div>
       </ContentCard>

       <ContentCard
        title="Push Notifications"
        subtitle="Browser and mobile push notifications"
       >
        <div className="space-y-4">
         <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
           <p className="font-medium text-printflow-on-surface">
            Enable push notifications
           </p>
           <p className="text-sm text-printflow-on-surface-variant">
            Receive real-time alerts in your browser
           </p>
          </div>
          <input
           type="checkbox"
           checked={s.pushNotifications}
           onChange={(e) => update("pushNotifications", e.target.checked)}
           className="w-5 h-5 text-printflow-primary border-printflow-outline-variant rounded focus:ring-printflow-primary"
          />
         </label>
         <div className="text-sm text-printflow-on-surface-variant">
          Push notifications require browser permission
         </div>
        </div>
       </ContentCard>
      </>
     )}

     {/* Security Settings */}
     {activeSection === "security" && (
      <>
       <ContentCard
        title="Two-Factor Authentication"
        subtitle="Add an extra layer of security to your account"
       >
        <div className="flex items-center justify-between gap-3">
         <div>
          <p className="font-medium text-printflow-on-surface">Enable 2FA</p>
          <p className="text-sm text-printflow-on-surface-variant">
           Require authenticator app code on login
          </p>
         </div>
         <input
          type="checkbox"
          checked={s.twoFactor}
          onChange={(e) => update("twoFactor", e.target.checked)}
          className="w-5 h-5 text-printflow-primary border-printflow-outline-variant rounded focus:ring-printflow-primary"
         />
        </div>
        <div className="mt-4 p-4 bg-printflow-surface-container rounded-lg">
         <p className="text-sm text-printflow-on-surface-variant">
          When enabled, you'll need to enter a code from your authenticator app
          (Google Authenticator, Authy, etc.) each time you sign in.
         </p>
        </div>
        <div className="flex justify-end gap-3 mt-4 border-t border-printflow-outline-variant pt-4">
         <Button variant="primary" onClick={() => toast.info("2FA setup flow opened")}>
          Setup 2FA
         </Button>
        </div>
       </ContentCard>

       <ContentCard
        title="Session Management"
        subtitle="Control session duration and device access"
       >
        <div className="space-y-4">
         <div>
          <label className={labelCls}>Session Timeout</label>
          <select
           value={s.sessionTimeout}
           onChange={(e) => update("sessionTimeout", e.target.value)}
           className={`${inputCls} max-w-xs`}
          >
           <option value="15">15 minutes</option>
           <option value="30">30 minutes</option>
           <option value="60">1 hour</option>
           <option value="120">2 hours</option>
           <option value="480">8 hours</option>
           <option value="0">Never expire</option>
          </select>
         </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 border-t border-printflow-outline-variant pt-4">
         <Button
          variant="secondary"
          onClick={() => toast.info("All other devices signed out")}
         >
          Log out all devices
         </Button>
         <Button variant="primary" onClick={() => handleSave("Session")}>
          <Save className="w-4 h-4 mr-2" /> Save Settings
         </Button>
        </div>
       </ContentCard>

       <ContentCard
        title="Change Password"
        subtitle="Update your account password"
       >
        <div className="space-y-4 max-w-md">
         <div>
          <label className={labelCls}>Current Password</label>
          <input
           type="password"
           className={inputCls}
          />
         </div>
         <div>
          <label className={labelCls}>New Password</label>
          <input
           type="password"
           className={inputCls}
          />
         </div>
         <div>
          <label className={labelCls}>Confirm New Password</label>
          <input
           type="password"
           className={inputCls}
          />
         </div>
         <div className="flex justify-end">
          <Button
           variant="primary"
           onClick={() => toast.success("Password updated")}
          >
           Update Password
          </Button>
         </div>
        </div>
       </ContentCard>
      </>
     )}

     {/* Integrations */}
     {activeSection === "integrations" && (
      <ContentCard
       title="Third-Party Integrations"
       subtitle="Connect PrintFlow with your favorite tools"
      >
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
         { name: "QuickBooks", description: "Sync orders and invoices", status: "connected", icon: <Database className="w-5 h-5" /> },
         { name: "Shopify", description: "Import orders from your store", status: "disconnected", icon: <ShoppingBag className="w-5 h-5" /> },
         { name: "Slack", description: "Receive notifications in channels", status: "connected", icon: <MessageSquare className="w-5 h-5" /> },
         { name: "Google Drive", description: "Store and share design files", status: "disconnected", icon: <HardDrive className="w-5 h-5" /> },
        ].map((integration) => (
         <div
          key={integration.name}
          className="flex items-center justify-between gap-3 p-4 bg-printflow-surface-container/50 rounded-lg border border-printflow-outline-variant/50"
         >
          <div className="flex items-center gap-4 min-w-0">
           <div className="p-2 bg-printflow-primary-fixed/20 rounded-lg shrink-0">
            {integration.icon}
           </div>
           <div className="min-w-0">
            <p className="font-medium text-printflow-on-surface truncate">
             {integration.name}
            </p>
            <p className="text-sm text-printflow-on-surface-variant truncate">
             {integration.description}
            </p>
           </div>
          </div>
          <Button
           variant={integration.status === "connected" ? "secondary" : "primary"}
           size="sm"
           onClick={() =>
            toast.success(
             integration.status === "connected"
              ? `Disconnected ${integration.name}`
              : `Connected ${integration.name}`,
            )
           }
          >
           {integration.status === "connected" ? "Disconnect" : "Connect"}
          </Button>
         </div>
        ))}
       </div>
      </ContentCard>
     )}

     {/* API Keys */}
     {activeSection === "api" && (
      <ContentCard
       title="API Keys"
       subtitle="Manage API access for integrations"
      >
       <div className="space-y-4">
        {[
         { name: "Production API", created: "Jan 10, 2024", used: "2 hours ago", prefix: "pf_prod_abc123" },
         { name: "Read-Only API", created: "Jan 12, 2024", used: "Never", prefix: "pf_read_xyz789" },
        ].map((key) => (
         <div
          key={key.name}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-printflow-surface-container/50 rounded-lg border border-printflow-outline-variant/50"
         >
          <div className="min-w-0">
           <p className="font-medium text-printflow-on-surface">{key.name}</p>
           <p className="text-sm text-printflow-on-surface-variant">
            Created {key.created} • Last used {key.used}
           </p>
           <code className="text-xs bg-printflow-surface-container px-2 py-1 rounded inline-block mt-1">
            {key.prefix}...
           </code>
          </div>
          <div className="flex gap-2">
           <Button
            variant="ghost"
            size="sm"
            onClick={() => toast.success(`${key.name} regenerated`)}
           >
            Regenerate
           </Button>
           <Button
            variant="ghost"
            size="sm"
            className="text-printflow-error"
            onClick={() => toast.error(`${key.name} revoked`)}
           >
            Revoke
           </Button>
          </div>
         </div>
        ))}
        <Button
         variant="primary"
         onClick={() => toast.success("New API key generated — copy now, it won't be shown again")}
        >
         <Plus className="w-4 h-4" />
         Generate New Key
        </Button>
       </div>
      </ContentCard>
     )}
    </div>
   </div>
  </AdminLayout>
 );
}

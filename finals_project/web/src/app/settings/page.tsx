"use client";

import { useState } from "react";
import { Save, Bell, Shield, Palette, Globe, Database, Key, Moon, Sun, Monitor, Smartphone, Settings, Plus, ShoppingBag, MessageSquare, HardDrive, ShoppingCart, Package, TrendingUp, BarChart3 } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, Button, EmptyState } from "@/components/ui";

const settingsSections = [
 { id: "general", label: "General", icon: <Settings className="w-5 h-5" /> },
 { id: "appearance", label: "Appearance", icon: <Palette className="w-5 h-5" /> },
 { id: "notifications", label: "Notifications", icon: <Bell className="w-5 h-5" /> },
 { id: "security", label: "Security", icon: <Shield className="w-5 h-5" /> },
 { id: "integrations", label: "Integrations", icon: <Database className="w-5 h-5" /> },
 { id: "api", label: "API Keys", icon: <Key className="w-5 h-5" /> },
];

export default function SettingsPage() {
 const [activeSection, setActiveSection] = useState("general");
 const [theme, setTheme] = useState("light");
 const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
 const [emailNotifications, setEmailNotifications] = useState(true);
 const [pushNotifications, setPushNotifications] = useState(false);
 const [twoFactor, setTwoFactor] = useState(false);
 const [sessionTimeout, setSessionTimeout] = useState("30");

 return (
  <AdminLayout
   title="Settings"
   subtitle="Configure your PrintFlow workspace preferences"
  >
   <div className="flex gap-8">
    {/* Settings Sidebar */}
    <aside className="w-56 flex-shrink-0">
     <nav className="bg-printflow-surface rounded-xl border border-printflow-outline-variant p-4" aria-label="Settings navigation">
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
       <ContentCard title="Company Information" subtitle="Basic information about your organization">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div>
          <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">Company Name</label>
          <input type="text" defaultValue="PrintFlow Operations" className="w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent" />
         </div>
         <div>
          <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">Industry</label>
          <select className="w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent">
           <option>Printing & Publishing</option>
           <option>Manufacturing</option>
           <option>Packaging</option>
           <option>Other</option>
          </select>
         </div>
         <div>
          <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">Timezone</label>
          <select className="w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent">
           <option>UTC-08:00 Pacific Time</option>
           <option>UTC-05:00 Eastern Time</option>
           <option>UTC+00:00 GMT</option>
           <option>UTC+01:00 CET</option>
          </select>
         </div>
         <div>
          <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">Currency</label>
          <select className="w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent">
           <option>USD ($)</option>
           <option>EUR (€)</option>
           <option>GBP (£)</option>
          </select>
         </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 border-t border-printflow-outline-variant pt-4">
         <Button variant="primary"><Save className="w-4 h-4 mr-2" /> Save Changes</Button>
        </div>
       </ContentCard>

       <ContentCard title="Default Preferences" subtitle="Set default values for new orders and projects">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div>
          <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">Default Paper Type</label>
          <select className="w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent">
           <option>Premium Cardstock 350gsm</option>
           <option>Matte Coated Paper 200gsm</option>
           <option>Glossy Photo Paper 250gsm</option>
          </select>
         </div>
         <div>
          <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">Default Finish</label>
          <select className="w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent">
           <option>None</option>
           <option>UV Coating</option>
           <option>Lamination</option>
           <option>Spot UV</option>
          </select>
         </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 border-t border-printflow-outline-variant pt-4">
         <Button variant="primary"><Save className="w-4 h-4 mr-2" /> Save Defaults</Button>
        </div>
       </ContentCard>
      </>
     )}

     {/* Appearance Settings */}
     {activeSection === "appearance" && (
      <>
       <ContentCard title="Theme" subtitle="Customize the look and feel of PrintFlow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <button
          onClick={() => setTheme("light")}
          className={`p-6 rounded-xl border-2 transition-all text-center ${
           theme === "light"
            ? "border-printflow-primary bg-printflow-primary-fixed/10"
            : "border-printflow-outline-variant hover:border-printflow-primary/50"
          }`}
         >
          <Sun className="w-10 h-10 mx-auto mb-3 text-printflow-primary" />
          <h4 className="font-semibold text-printflow-on-surface mb-1">Light</h4>
          <p className="text-sm text-printflow-on-surface-variant">Clean, bright interface</p>
         </button>
         <button
          onClick={() => setTheme("dark")}
          className={`p-6 rounded-xl border-2 transition-all text-center ${
           theme === "dark"
            ? "border-printflow-primary bg-printflow-primary-fixed/10"
            : "border-printflow-outline-variant hover:border-printflow-primary/50"
          }`}
         >
          <Moon className="w-10 h-10 mx-auto mb-3 text-printflow-primary" />
          <h4 className="font-semibold text-printflow-on-surface mb-1">Dark</h4>
          <p className="text-sm text-printflow-on-surface-variant">Easy on the eyes</p>
         </button>
         <button
          onClick={() => setTheme("system")}
          className={`p-6 rounded-xl border-2 transition-all text-center ${
           theme === "system"
            ? "border-printflow-primary bg-printflow-primary-fixed/10"
            : "border-printflow-outline-variant hover:border-printflow-primary/50"
          }`}
         >
          <Monitor className="w-10 h-10 mx-auto mb-3 text-printflow-primary" />
          <h4 className="font-semibold text-printflow-on-surface mb-1">System</h4>
          <p className="text-sm text-printflow-on-surface-variant">Match OS preference</p>
         </button>
        </div>
       </ContentCard>

       <ContentCard title="Sidebar Preferences" subtitle="Customize navigation behavior">
        <div className="space-y-4">
         <label className="flex items-center justify-between">
          <div>
           <p className="font-medium text-printflow-on-surface">Collapse sidebar by default</p>
           <p className="text-sm text-printflow-on-surface-variant">Start with minimized navigation</p>
          </div>
          <input
           type="checkbox"
           checked={sidebarCollapsed}
           onChange={(e) => setSidebarCollapsed(e.target.checked)}
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
       <ContentCard title="Email Notifications" subtitle="Configure when you receive email alerts">
        <div className="space-y-4">
         <label className="flex items-center justify-between">
          <div>
           <p className="font-medium text-printflow-on-surface">Order updates</p>
           <p className="text-sm text-printflow-on-surface-variant">New orders, status changes, completions</p>
          </div>
          <input type="checkbox" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} className="w-5 h-5 text-printflow-primary border-printflow-outline-variant rounded focus:ring-printflow-primary" />
         </label>
         <label className="flex items-center justify-between">
          <div>
           <p className="font-medium text-printflow-on-surface">Low stock alerts</p>
           <p className="text-sm text-printflow-on-surface-variant">When inventory falls below minimum levels</p>
          </div>
          <input type="checkbox" checked={true} className="w-5 h-5 text-printflow-primary border-printflow-outline-variant rounded focus:ring-printflow-primary" />
         </label>
         <label className="flex items-center justify-between">
          <div>
           <p className="font-medium text-printflow-on-surface">Production delays</p>
           <p className="text-sm text-printflow-on-surface-variant">Jobs running behind schedule</p>
          </div>
          <input type="checkbox" checked={true} className="w-5 h-5 text-printflow-primary border-printflow-outline-variant rounded focus:ring-printflow-primary" />
         </label>
         <label className="flex items-center justify-between">
          <div>
           <p className="font-medium text-printflow-on-surface">Weekly summary</p>
           <p className="text-sm text-printflow-on-surface-variant">Weekly digest of operations metrics</p>
          </div>
          <input type="checkbox" checked={false} className="w-5 h-5 text-printflow-primary border-printflow-outline-variant rounded focus:ring-printflow-primary" />
         </label>
        </div>
       </ContentCard>

       <ContentCard title="Push Notifications" subtitle="Browser and mobile push notifications">
        <div className="space-y-4">
         <label className="flex items-center justify-between">
          <div>
           <p className="font-medium text-printflow-on-surface">Enable push notifications</p>
           <p className="text-sm text-printflow-on-surface-variant">Receive real-time alerts in your browser</p>
          </div>
          <input type="checkbox" checked={pushNotifications} onChange={(e) => setPushNotifications(e.target.checked)} className="w-5 h-5 text-printflow-primary border-printflow-outline-variant rounded focus:ring-printflow-primary" />
         </label>
         <div className="text-sm text-printflow-on-surface-variant">Push notifications require browser permission</div>
        </div>
       </ContentCard>
      </>
     )}

     {/* Security Settings */}
     {activeSection === "security" && (
      <>
       <ContentCard title="Two-Factor Authentication" subtitle="Add an extra layer of security to your account">
        <div className="flex items-center justify-between">
         <div>
          <p className="font-medium text-printflow-on-surface">Enable 2FA</p>
          <p className="text-sm text-printflow-on-surface-variant">Require authenticator app code on login</p>
         </div>
         <input type="checkbox" checked={twoFactor} onChange={(e) => setTwoFactor(e.target.checked)} className="w-5 h-5 text-printflow-primary border-printflow-outline-variant rounded focus:ring-printflow-primary" />
        </div>
        <div className="mt-4 p-4 bg-printflow-surface-container rounded-lg">
         <p className="text-sm text-printflow-on-surface-variant">When enabled, you'll need to enter a code from your authenticator app (Google Authenticator, Authy, etc.) each time you sign in.</p>
        </div>
        <div className="flex justify-end gap-3 mt-4 border-t border-printflow-outline-variant pt-4">
         <Button variant="primary">Setup 2FA</Button>
        </div>
       </ContentCard>

       <ContentCard title="Session Management" subtitle="Control session duration and device access">
        <div className="space-y-4">
         <div>
          <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">Session Timeout</label>
          <select value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} className="w-full max-w-xs px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent">
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
         <Button variant="secondary">Log out all devices</Button>
         <Button variant="primary"><Save className="w-4 h-4 mr-2" /> Save Settings</Button>
        </div>
       </ContentCard>

       <ContentCard title="Change Password" subtitle="Update your account password">
        <div className="space-y-4 max-w-md">
         <div>
          <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">Current Password</label>
          <input type="password" className="w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent" />
         </div>
         <div>
          <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">New Password</label>
          <input type="password" className="w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent" />
         </div>
         <div>
          <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">Confirm New Password</label>
          <input type="password" className="w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent" />
         </div>
         <div className="flex justify-end">
          <Button variant="primary">Update Password</Button>
         </div>
        </div>
       </ContentCard>
      </>
     )}

     {/* Integrations */}
     {activeSection === "integrations" && (
      <ContentCard title="Third-Party Integrations" subtitle="Connect PrintFlow with your favorite tools">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
         { name: "QuickBooks", description: "Sync orders and invoices", status: "connected", icon: <Database className="w-5 h-5" /> },
         { name: "Shopify", description: "Import orders from your store", status: "disconnected", icon: <ShoppingBag className="w-5 h-5" /> },
         { name: "Slack", description: "Receive notifications in channels", status: "connected", icon: <MessageSquare className="w-5 h-5" /> },
         { name: "Google Drive", description: "Store and share design files", status: "disconnected", icon: <HardDrive className="w-5 h-5" /> },
        ].map((integration) => (
         <div key={integration.name} className="flex items-center justify-between p-4 bg-printflow-surface-container/50 rounded-lg border border-printflow-outline-variant/50">
          <div className="flex items-center gap-4">
           <div className="p-2 bg-printflow-primary-fixed/20 rounded-lg">
            {integration.icon}
           </div>
           <div>
            <p className="font-medium text-printflow-on-surface">{integration.name}</p>
            <p className="text-sm text-printflow-on-surface-variant">{integration.description}</p>
           </div>
          </div>
          <Button variant={integration.status === "connected" ? "secondary" : "primary"} size="sm">
           {integration.status === "connected" ? "Disconnect" : "Connect"}
          </Button>
         </div>
        ))}
       </div>
      </ContentCard>
     )}

     {/* API Keys */}
     {activeSection === "api" && (
      <ContentCard title="API Keys" subtitle="Manage API access for integrations">
       <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-printflow-surface-container/50 rounded-lg border border-printflow-outline-variant/50">
         <div>
          <p className="font-medium text-printflow-on-surface">Production API</p>
          <p className="text-sm text-printflow-on-surface-variant">Created Jan 10, 2024 • Last used 2 hours ago</p>
          <code className="text-xs bg-printflow-surface-container px-2 py-1 rounded">pf_prod_abc123...</code>
         </div>
         <div className="flex gap-2">
          <Button variant="ghost" size="sm">Regenerate</Button>
          <Button variant="ghost" size="sm" className="text-printflow-error">Revoke</Button>
         </div>
        </div>
        <div className="flex items-center justify-between p-4 bg-printflow-surface-container/50 rounded-lg border border-printflow-outline-variant/50">
         <div>
          <p className="font-medium text-printflow-on-surface">Read-Only API</p>
          <p className="text-sm text-printflow-on-surface-variant">Created Jan 12, 2024 • Never used</p>
          <code className="text-xs bg-printflow-surface-container px-2 py-1 rounded">pf_read_xyz789...</code>
         </div>
         <div className="flex gap-2">
          <Button variant="ghost" size="sm">Regenerate</Button>
          <Button variant="ghost" size="sm" className="text-printflow-error">Revoke</Button>
         </div>
        </div>
        <Button variant="primary">
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
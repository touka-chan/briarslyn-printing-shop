"use client";

import { useEffect, useState, ReactNode } from "react";
import {
 Bell,
 Search,
 User,
 LogOut,
 Moon,
 Sun,
 ChevronDown,
 Settings,
 Package,
 AlertTriangle,
 ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { subscribeOrders } from "@/lib/services/orders";
import { subscribeInventory } from "@/lib/services/inventory";
import type { Order, InventoryItem } from "@/types";

interface HeaderProps {
 title: string;
 subtitle?: string;
 actions?: ReactNode;
 onSearch?: (value: string) => void;
 searchPlaceholder?: string;
}

type Theme = "light" | "dark";

function readStoredTheme(): Theme {
 if (typeof window === "undefined") return "light";
 try {
  const t = localStorage.getItem("printflow-theme");
  if (t === "dark" || t === "light") return t;
 } catch {}
 if (
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
 ) {
  return "dark";
 }
 return "light";
}

function applyTheme(theme: Theme) {
 const root = document.documentElement;
 if (theme === "dark") {
  root.classList.add("dark");
 } else {
  root.classList.remove("dark");
 }
 try {
  localStorage.setItem("printflow-theme", theme);
 } catch {}
}

function timeAgo(iso: string, now: Date = new Date()): string {
 if (!iso) return "";
 const then = new Date(iso);
 if (isNaN(then.getTime())) return "";
 const ms = now.getTime() - then.getTime();
 if (ms < 0) return "just now";
 const mins = Math.round(ms / 60000);
 if (mins < 1) return "just now";
 if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
 const hrs = Math.round(mins / 60);
 if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
 const days = Math.round(hrs / 24);
 return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function Header({
 title,
 subtitle,
 actions,
 onSearch,
 searchPlaceholder = "Search orders, inventory...",
}: HeaderProps) {
 const [notificationsOpen, setNotificationsOpen] = useState(false);
 const [userMenuOpen, setUserMenuOpen] = useState(false);
 const [searchValue, setSearchValue] = useState("");
 const [theme, setTheme] = useState<Theme>("light");
 const [mounted, setMounted] = useState(false);
 const [orders, setOrders] = useState<Order[]>([]);
 const [inventory, setInventory] = useState<InventoryItem[]>([]);
 const [signOutOpen, setSignOutOpen] = useState(false);
 const [signingOut, setSigningOut] = useState(false);
 const { user, signOut } = useAuth();
 const router = useRouter();

 useEffect(() => {
  setMounted(true);
  setTheme(readStoredTheme());
 }, []);

 useEffect(() => {
  const unsubOrders = subscribeOrders(setOrders);
  const unsubInv = subscribeInventory(setInventory);
  return () => {
   unsubOrders();
   unsubInv();
  };
 }, []);

 const toggleTheme = () => {
  const next: Theme = theme === "dark" ? "light" : "dark";
  setTheme(next);
  applyTheme(next);
 };

 const handleSearchChange = (value: string) => {
  setSearchValue(value);
  onSearch?.(value);
 };

 const requestSignOut = () => {
  setUserMenuOpen(false);
  setSignOutOpen(true);
 };

 const cancelSignOut = () => {
  if (signingOut) return;
  setSignOutOpen(false);
 };

 const handleSignOut = async () => {
  setSigningOut(true);
  try {
   await signOut();
  } catch (err) {
   // Log so future "sign-out does nothing" reports have something to
   // chase in the browser console. The user still gets redirected —
   // we never leave them stuck on this modal.
   console.error("[Header] signOut() failed:", err);
  } finally {
   setSigningOut(false);
   setSignOutOpen(false);
   // Force-navigate to /login. AuthGate *should* pick up the
   // onAuthStateChanged event on its own, but relying on it alone
   // leaves a window where the user sees a half-rendered page
   // (loading state + stale data). Replace, not push, so the
   // protected URL doesn't end up in browser history.
   router.replace("/login");
  }
 };

 // Derive three live notifications from real data
 const latestReady = orders.find((o) => o.status === "Ready for Pickup");
 const lowStockItem = [...inventory]
  .sort((a, b) => a.current_stock - b.current_stock)
  .find((i) => i.current_stock <= i.reorder_point);
 const newestOrder = [...orders].sort(
  (a, b) =>
   new Date(b.created_at ?? b.target_date).getTime() -
   new Date(a.created_at ?? a.target_date).getTime(),
 )[0];

 const notifications = [
  latestReady && {
   id: `ready-${latestReady.id ?? latestReady.order_id}`,
   icon: Package,
   accent: "text-printflow-success",
   title: `Order ${latestReady.order_id}`,
   detail: `Ready for pickup — ${latestReady.customer_name}`,
   meta: "Production completed",
  },
  lowStockItem && {
   id: `low-${lowStockItem.id ?? lowStockItem.material_variant_id}`,
   icon: AlertTriangle,
   accent: "text-printflow-warning",
   title: "Low stock alert",
   detail: `${lowStockItem.item_type} — ${lowStockItem.current_stock} units remaining`,
   meta: "Reorder recommended",
  },
  newestOrder && {
   id: `new-${newestOrder.id ?? newestOrder.order_id}`,
   icon: ShoppingBag,
   accent: "text-printflow-primary",
   title: "New order received",
   detail: `Order ${newestOrder.order_id} from ${newestOrder.customer_name}`,
   meta: timeAgo(newestOrder.created_at ?? newestOrder.target_date),
  },
 ].filter(Boolean) as Array<{
  id: string;
  icon: typeof Package;
  accent: string;
  title: string;
  detail: string;
  meta: string;
 }>;

 const displayName = user?.name ?? "Signed in";
 const displayEmail = user?.email ?? "";
 const displayRole = user?.role ?? "";

 return (
  <>
   <header className="sticky top-0 z-30 bg-printflow-surface/80 backdrop-blur-sm border-b border-printflow-outline-variant">
   <div className="flex items-center justify-between h-16 px-6 gap-4">
    {/* Left: Title */}
    <div className="flex-1 min-w-0">
     <h1 className="text-xl font-semibold text-printflow-on-surface truncate">
      {title}
     </h1>
     {subtitle && (
      <p className="text-sm text-printflow-on-surface-variant truncate">
       {subtitle}
      </p>
     )}
    </div>

    {/* Center: Search (hidden on mobile) */}
    <div className="hidden md:flex flex-1 max-w-xl mx-8">
     <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-printflow-on-surface-variant w-5 h-5 pointer-events-none" />
      <input
       type="text"
       placeholder={searchPlaceholder}
       value={searchValue}
       onChange={(e) => handleSearchChange(e.target.value)}
       className="w-full px-4 py-2 pl-10 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent transition-all"
       aria-label="Global search"
      />
     </div>
    </div>

    {/* Right: Actions */}
    <div className="flex items-center gap-3">
     {actions}

     {/* Notifications */}
     <div className="relative">
      <button
       onClick={() => setNotificationsOpen(!notificationsOpen)}
       className="btn-ghost p-2 relative"
       aria-label="Notifications"
       aria-expanded={notificationsOpen}
      >
       <Bell className="w-5 h-5" />
       {notifications.length > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-printflow-error rounded-full" />
       )}
      </button>

      {notificationsOpen && (
       <div
        className="absolute right-0 mt-2 w-80 bg-printflow-surface rounded-xl shadow-lg border border-printflow-outline-variant py-2 z-50"
        style={{ animation: "slide-in-up 180ms ease-out" }}
       >
        <div className="px-4 py-3 border-b border-printflow-outline-variant flex items-center justify-between">
         <h3 className="font-semibold text-printflow-on-surface">Notifications</h3>
         <span className="type-label text-printflow-on-surface-variant">
          {notifications.length} new
         </span>
        </div>
        <div className="max-h-72 overflow-y-auto scrollbar-thin">
         {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-printflow-on-surface-variant">
           You&apos;re all caught up.
          </div>
         ) : (
          notifications.map((n, idx) => {
           const Icon = n.icon;
           return (
            <div
             key={n.id}
             className={`px-4 py-3 flex gap-3 ${
              idx > 0 ? "border-t border-printflow-outline-variant/60" : ""
             }`}
            >
             <div
              className={`shrink-0 w-8 h-8 rounded-full bg-printflow-surface-container flex items-center justify-center ${n.accent}`}
             >
              <Icon className="w-4 h-4" />
             </div>
             <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-printflow-on-surface">
               {n.title}
              </p>
              <p className="text-xs text-printflow-on-surface-variant truncate">
               {n.detail}
              </p>
              <p className="text-xs text-printflow-on-surface-variant/80 mt-0.5">
               {n.meta}
              </p>
             </div>
            </div>
           );
          })
         )}
        </div>
        <div className="p-3 border-t border-printflow-outline-variant">
         <Button variant="secondary" className="w-full" size="sm">
          View all activity
         </Button>
        </div>
       </div>
      )}
     </div>

     {/* Theme Toggle */}
     <button
      onClick={toggleTheme}
      className="btn-ghost p-2"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
     >
      {mounted && theme === "dark" ? (
       <Sun className="w-5 h-5" />
      ) : (
       <Moon className="w-5 h-5" />
      )}
     </button>

     {/* User Menu */}
     <div className="relative">
      <button
       onClick={() => setUserMenuOpen(!userMenuOpen)}
       className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-printflow-surface-container transition-colors"
       aria-label="User menu"
       aria-expanded={userMenuOpen}
      >
       <div className="w-8 h-8 bg-printflow-primary-fixed rounded-full flex items-center justify-center">
        <User className="w-5 h-5 text-printflow-primary" />
       </div>
       <div className="hidden sm:block text-left">
        <p className="text-sm font-medium text-printflow-on-surface leading-tight">
         {displayName}
        </p>
        <p className="text-xs text-printflow-on-surface-variant leading-tight">
         {displayRole}
        </p>
       </div>
       <ChevronDown className="w-4 h-4 text-printflow-on-surface-variant" />
      </button>

      {userMenuOpen && (
       <div
        className="absolute right-0 mt-2 w-60 bg-printflow-surface rounded-xl shadow-lg border border-printflow-outline-variant py-2 z-50"
        style={{ animation: "slide-in-up 180ms ease-out" }}
       >
        <div className="px-4 py-3 border-b border-printflow-outline-variant">
         <p className="font-medium text-printflow-on-surface truncate">
          {displayName}
         </p>
         <p className="text-xs text-printflow-on-surface-variant truncate">
          {displayEmail}
         </p>
         {displayRole && (
          <p className="text-xs text-printflow-success mt-1">{displayRole}</p>
         )}
        </div>
        <Link href="/settings" className="dropdown-item flex items-center gap-3 w-full">
         <User className="w-4 h-4" />
         Profile
        </Link>
        <Link href="/settings" className="dropdown-item flex items-center gap-3 w-full">
         <Settings className="w-4 h-4" />
         Settings
        </Link>
        <hr className="my-2 border-printflow-outline-variant" />
        <button
         onClick={requestSignOut}
         className="dropdown-item w-full text-printflow-error flex items-center gap-3"
        >
         <LogOut className="w-4 h-4" />
         Sign out
        </button>
       </div>
      )}
     </div>
    </div>
   </div>
  </header>

  {/* Sign-out confirmation — non-dismissible: must click a button to close. */}
  <Modal
   isOpen={signOutOpen}
   onClose={cancelSignOut}
   title="Sign out of PrintFlow?"
   description="You'll need to sign in again to access orders, inventory, and the rest of the workspace."
   icon={<LogOut className="w-5 h-5" />}
   size="sm"
   closeOnOverlayClick={!signingOut}
   dismissible={!signingOut}
   footer={
    <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
     <Button
      variant="secondary"
      onClick={cancelSignOut}
      className="flex-1 sm:flex-none"
      disabled={signingOut}
     >
      Cancel
     </Button>
     <Button
      variant="danger"
      onClick={handleSignOut}
      className="flex-1 sm:flex-none shadow-sm"
      loading={signingOut}
      disabled={signingOut}
     >
      Sign out
     </Button>
    </div>
   }
  >
   {displayEmail && (
    <div className="px-3 py-2 rounded-lg bg-printflow-surface-container/50 border border-printflow-outline-variant/40 text-[12px] text-printflow-on-surface-variant">
     Signed in as <span className="font-medium text-printflow-on-surface">{displayEmail}</span>
    </div>
   )}
  </Modal>
  </>
 );
}

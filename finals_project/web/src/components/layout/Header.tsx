"use client";

import { useEffect, useState, ReactNode } from "react";
import {
  Bell,
  Search,
  User,
  LogOut,
  Moon,
  Sun,
  Package,
  AlertTriangle,
  ShoppingBag,
  Banknote,
  WifiOff,
  Clock,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useFeedStatus } from "@/lib/useFeedStatus";
import { subscribeOrders } from "@/lib/services/orders";
import { subscribeInventory } from "@/lib/services/inventory";
import { subscribeUsageEvents } from "@/lib/services/usage";
import { subscribeUsers } from "@/lib/services/users";
import { getInventoryStatus, getPriority } from "@/lib/derived";
import type { Order, InventoryItem, UsageEvent, User as UserType } from "@/types";

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
  // Default is ALWAYS light. The OS color scheme is deliberately
  // ignored - a dark-mode OS must never force the panel dark.
  // Dark applies only when the user explicitly picks it (moon toggle
  // or Settings > Appearance), which stores "dark".
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

const DISMISSED_KEY = "printflow-dismissed-notifs";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

interface HeaderNotification {
  id: string;
  icon: typeof Package;
  accent: string;
  title: string;
  detail: string;
  meta: string;
  href: string;
}

export function Header({
 title,
 subtitle,
 actions,
 onSearch,
 searchPlaceholder = "Search orders, inventory...",
}: HeaderProps) {
 const [notificationsOpen, setNotificationsOpen] = useState(false);

 const [searchValue, setSearchValue] = useState("");
 const [theme, setTheme] = useState<Theme>("light");
 const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [usage, setUsage] = useState<UsageEvent[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
   setMounted(true);
   setTheme(readStoredTheme());
  }, []);

  // Feed errors surface as a dropdown row (with retry) instead of a
  // silently empty bell.
  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  useEffect(() => {
   const unsubOrders = subscribeOrders(setOrders, onFeedError);
   const unsubInv = subscribeInventory(setInventory, onFeedError);
   const unsubUsage = subscribeUsageEvents(setUsage, 100, onFeedError);
   const unsubUsers = subscribeUsers(setAllUsers, onFeedError);
   return () => {
    unsubOrders();
    unsubInv();
    unsubUsage();
    unsubUsers();
   };
  }, [feedNonce, onFeedError]);

  // Close the notifications dropdown on Escape.
  useEffect(() => {
   if (!notificationsOpen) return;
   const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setNotificationsOpen(false);
   };
   window.addEventListener("keydown", onKey);
   return () => window.removeEventListener("keydown", onKey);
  }, [notificationsOpen]);

  const dismissNotification = (id: string) => {
   setDismissed((prev) => {
    const next = new Set(prev);
    next.add(id);
    try {
     window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    } catch {
     // Storage full/blocked - dismiss just won't persist.
    }
    return next;
   });
  };

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
   // chase in the browser console. The user still gets redirected -
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

  // Federated notification center - derived live from the same
  // collections the mobile app writes (orders, inventory, usage_events,
  // users), so every cashier/production action surfaces here in realtime.
  // Resolved alerts vanish on their own; dismissed ones stay hidden
  // per browser (localStorage).
  const notifications: HeaderNotification[] = (() => {
   const out: HeaderNotification[] = [];
   const seenOrders = new Set<string>();
   const userName = (uid?: string | null) =>
    (uid && allUsers.find((u) => u.id === uid)?.name) || null;

   // 1. Overdue orders (oldest target first).
   const overdue = orders
    .filter(
     (o) =>
      o.status !== "Completed" &&
      (o.status as string) !== "Cancelled" &&
      getPriority(o) === "Overdue",
    )
    .sort((a, b) => a.target_date.localeCompare(b.target_date))
    .slice(0, 3);
   for (const o of overdue) {
    seenOrders.add(o.order_id);
    out.push({
     id: `overdue-${o.order_id}`,
     icon: AlertTriangle,
     accent: "text-printflow-error",
     title: `Order ${o.order_id} is overdue`,
     detail: `${o.customer_name} - target was ${o.target_date}`,
     meta: "Needs attention now",
     href: "/orders",
    });
   }

   // 2. Urgent orders (nearest target first).
   const urgent = orders
    .filter(
     (o) =>
      o.status !== "Completed" &&
      (o.status as string) !== "Cancelled" &&
      getPriority(o) === "Urgent",
    )
    .sort((a, b) => a.target_date.localeCompare(b.target_date))
    .slice(0, 2);
   for (const o of urgent) {
    seenOrders.add(o.order_id);
    out.push({
     id: `urgent-${o.order_id}`,
     icon: Clock,
     accent: "text-printflow-warning",
     title: `Urgent: ${o.item_type}`,
     detail: `${o.customer_name} - target ${o.target_date}`,
     meta: "Due within 2 days",
     href: "/orders",
    });
   }

   // 3. Insufficient stock (emptiest first).
   const insufficient = inventory
    .filter((i) => getInventoryStatus(i) === "Insufficient Stock")
    .sort((a, b) => a.current_stock - b.current_stock)
    .slice(0, 2);
   for (const i of insufficient) {
    out.push({
     id: `insufficient-${i.material_variant_id}`,
     icon: AlertTriangle,
     accent: "text-printflow-error",
     title: `${i.material_variant_id} out of stock`,
     detail: `${i.item_type} - ${i.current_stock} units left`,
     meta: "Restock urgently",
     href: "/inventory",
    });
   }

   // 4. Ready for pickup.
   const ready = orders
    .filter((o) => o.status === "Ready for Pickup")
    .slice(0, 2);
   for (const o of ready) {
    seenOrders.add(o.order_id);
    out.push({
     id: `ready-${o.id ?? o.order_id}`,
     icon: Package,
     accent: "text-printflow-success",
     title: `Order ${o.order_id} ready`,
     detail: `Ready for pickup - ${o.customer_name}`,
     meta: "Production completed",
     href: "/production",
    });
   }

   // 5. Low stock.
   const low = inventory
    .filter((i) => getInventoryStatus(i) === "Low Stock")
    .sort((a, b) => a.current_stock - b.current_stock)
    .slice(0, 2);
   for (const i of low) {
    out.push({
     id: `low-${i.material_variant_id}`,
     icon: AlertTriangle,
     accent: "text-printflow-warning",
     title: "Low stock alert",
     detail: `${i.item_type} - ${i.current_stock} units remaining`,
     meta: "Reorder recommended",
     href: "/inventory",
    });
   }

   // 6. Latest stock movements (who moved what, from the app).
   // Only the trailing 7 days - older movements are history, not news.
   const weekAgo = Date.now() - 7 * 86400000;
   const recentUsage = usage
    .filter((u) => {
     const t = new Date(u.timestamp ?? "").getTime();
     return !isNaN(t) && t >= weekAgo;
    })
    .slice(0, 2);
   for (const u of recentUsage) {
    const actor = userName(u.by_uid);
    const when = timeAgo(u.timestamp ?? "");
    if (u.direction === "in") {
     out.push({
      id: `usage-${u.id ?? `${u.material_variant_id}-${u.timestamp}`}`,
      icon: Package,
      accent: "text-printflow-success",
      title: `Stock in +${u.qty} ${u.material_variant_id}`,
      detail: [u.reason, actor ? `by ${actor}` : null]
       .filter(Boolean)
       .join(" - "),
      meta: when || "Just now",
      href: "/inventory",
     });
    } else {
     const src =
      u.source === "auto-deduct" && u.order_id
       ? `auto-deduct ${u.order_id}`
       : (u.reason ?? u.source);
     out.push({
      id: `usage-${u.id ?? `${u.material_variant_id}-${u.timestamp}`}`,
      icon: Package,
      accent: "text-printflow-warning",
      title: `Usage -${u.qty} ${u.material_variant_id}`,
      detail: [src, actor ? `by ${actor}` : null].filter(Boolean).join(" - "),
      meta: when || "Just now",
      href: "/inventory",
     });
    }
   }

   // 7. Newest orders (skip ones already listed above), with cashier.
   // Only orders from the trailing 48h count as "new" - older ones
   // are queue residents, not news.
   const twoDaysAgo = Date.now() - 2 * 86400000;
   const newest = [...orders]
    .sort(
     (a, b) =>
      new Date(b.created_at ?? b.target_date).getTime() -
      new Date(a.created_at ?? a.target_date).getTime(),
    )
    .filter((o) => !seenOrders.has(o.order_id))
    .filter((o) => {
     const t = new Date(o.created_at ?? o.target_date).getTime();
     return !isNaN(t) && t >= twoDaysAgo;
    })
    .slice(0, 2);
   for (const o of newest) {
    const cashier = userName(o.cashier_id);
    out.push({
     id: `new-${o.id ?? o.order_id}`,
     icon: ShoppingBag,
     accent: "text-printflow-primary",
     title: "New order received",
     detail:
      `Order ${o.order_id} from ${o.customer_name}` +
      (cashier ? ` (by ${cashier})` : ""),
     meta: timeAgo(o.created_at ?? o.target_date) || "Just now",
     href: "/orders",
    });
   }

   // 8. Outstanding receivables (single summary row).
   // The id carries total+count so dismissing expires: new unpaid
   // orders (different total) resurface instead of staying hidden.
   const outstanding = orders.filter(
    (o) =>
     !!o.payment_method &&
     o.payment_status !== "Paid" &&
     o.payment_status !== "Full Paid",
   );
   if (outstanding.length > 0) {
    const total = outstanding.reduce((s, o) => s + o.payment_amount, 0);
    out.push({
     id: `outstanding-${total}-${outstanding.length}`,
     icon: Banknote,
     accent: "text-printflow-primary",
     title: `₱${total.toLocaleString("en-PH", { maximumFractionDigits: 0 })} outstanding`,
     detail: `Across ${outstanding.length} unpaid order${outstanding.length === 1 ? "" : "s"}`,
     meta: "Collect before completion",
     href: "/sales",
    });
   }

   // 9. Stale sensor (>12h without sync).
   const stale = inventory.find((i) => i.isStale);
   if (stale) {
    out.push({
     id: `stale-${stale.material_variant_id}`,
     icon: WifiOff,
     accent: "text-printflow-warning",
     title: "Sensor delayed",
     detail: `${stale.sensor_id ?? stale.material_variant_id} - no sync in 12h`,
     meta: "Check the station",
     href: "/inventory",
    });
   }

   return out.filter((n) => !dismissed.has(n.id)).slice(0, 10);
  })();

  const clearAllNotifications = () => {
   const ids = notifications.map((n) => n.id);
   if (ids.length === 0) return;
   setDismissed((prev) => {
    const next = new Set(prev);
    for (const id of ids) next.add(id);
    try {
     window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    } catch {
     // Storage full/blocked - dismiss just won't persist.
    }
    return next;
   });
  };

  const displayName = user?.name ?? "Signed in";
 const displayEmail = user?.email ?? "";
 const displayRole = user?.role ?? "";

 return (
  <>
   <header className="sticky top-3 z-30 bg-printflow-surface/80 backdrop-blur-sm border-b border-printflow-outline-variant rounded-t-2xl">
    <div className="flex items-center justify-between h-14 px-5 gap-4">
     {/* Left: Title */}
     <div className="flex-1 min-w-0">
       <h1 className="font-display text-lg font-semibold text-printflow-on-surface truncate">
       {title}
      </h1>
     {subtitle && (
      <p className="text-sm text-printflow-on-surface-variant truncate">
       {subtitle}
      </p>
     )}
    </div>

     {/* Center: Search (hidden on mobile). Only rendered when the page
         wires a handler - an unwired box would silently filter nothing. */}
     {onSearch && (
      <div className="hidden md:flex flex-1 max-w-xl mx-8">
       <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-printflow-on-surface-variant w-5 h-5 pointer-events-none" />
        <input
         type="text"
         placeholder={searchPlaceholder}
         value={searchValue}
         onChange={(e) => handleSearchChange(e.target.value)}
         className="w-full px-4 py-2 pl-10 text-sm bg-printflow-surface-container rounded-full border border-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all"
         aria-label="Global search"
        />
       </div>
      </div>
     )}

    {/* Right: Actions */}
    <div className="flex items-center gap-3">
     {actions}

      {/* Notifications */}
      <div className="relative">
       <button
        onClick={() => setNotificationsOpen(!notificationsOpen)}
        className="btn-ghost p-2 relative"
        aria-label={
         notifications.length > 0
          ? `Notifications, ${notifications.length} new`
          : "Notifications"
        }
        aria-expanded={notificationsOpen}
       >
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
         <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-printflow-error text-white text-[10px] font-bold flex items-center justify-center">
          {notifications.length > 9 ? "9+" : notifications.length}
         </span>
        )}
       </button>

       {notificationsOpen && (
        <>
         <div
          className="fixed inset-0 z-40"
          onClick={() => setNotificationsOpen(false)}
          aria-hidden
         />
         <div
          className="absolute right-0 mt-2 w-80 bg-printflow-surface rounded-xl shadow-lg border border-printflow-outline-variant py-2 z-50"
          style={{ animation: "slide-in-up 180ms ease-out" }}
          role="menu"
          aria-label="Notifications"
         >
          <div className="px-4 py-3 border-b border-printflow-outline-variant flex items-center justify-between">
           <h3 className="font-semibold text-printflow-on-surface">Notifications</h3>
           <div className="flex items-center gap-2">
            <span className="type-label text-printflow-on-surface-variant">
             {notifications.length === 0
              ? "caught up"
              : `${notifications.length} new`}
            </span>
            {notifications.length > 0 && (
             <button
              type="button"
              onClick={clearAllNotifications}
              className="text-xs font-medium text-printflow-primary hover:underline focus:outline-none focus:ring-2 focus:ring-printflow-primary rounded px-1"
             >
              Clear all
             </button>
            )}
           </div>
          </div>
          <div className="max-h-72 overflow-y-auto scrollbar-thin">
           {feedError && (
            <div
             role="alert"
             className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-xs flex items-center gap-2"
            >
             <span className="flex-1 min-w-0 truncate" title={feedError}>
              Couldn&apos;t refresh: {feedError}
             </span>
             <button
              type="button"
              onClick={retryFeed}
              className="shrink-0 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-printflow-error rounded px-1"
             >
              Retry
             </button>
            </div>
           )}
           {notifications.length === 0 && !feedError ? (
            <div className="px-4 py-8 text-center text-sm text-printflow-on-surface-variant">
             You&apos;re all caught up.
            </div>
           ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-printflow-on-surface-variant">
             No notifications to show.
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
               <button
                type="button"
                onClick={() => {
                 setNotificationsOpen(false);
                 router.push(n.href);
                }}
                className="min-w-0 flex-1 flex gap-3 text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-printflow-primary"
               >
                <span
                 className={`shrink-0 w-8 h-8 rounded-full bg-printflow-surface-container flex items-center justify-center ${n.accent}`}
                >
                 <Icon className="w-4 h-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                 <span className="block text-sm font-medium text-printflow-on-surface">
                  {n.title}
                 </span>
                 <span className="block text-xs text-printflow-on-surface-variant truncate">
                  {n.detail}
                 </span>
                 <span className="block text-xs text-printflow-on-surface-variant/80 mt-0.5">
                  {n.meta}
                 </span>
                </span>
               </button>
               <button
                type="button"
                onClick={() => dismissNotification(n.id)}
                className="shrink-0 self-start p-1 rounded-md text-printflow-on-surface-variant/60 hover:text-printflow-on-surface hover:bg-printflow-surface-container focus:outline-none focus:ring-2 focus:ring-printflow-primary"
                aria-label={`Dismiss: ${n.title}`}
                title="Dismiss"
               >
                <X className="w-3.5 h-3.5" aria-hidden />
               </button>
              </div>
             );
            })
           )}
          </div>
         </div>
        </>
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

      {/* Profile chip (static — no dropdown) + logout button beside it. */}
      <div className="flex items-center gap-2 p-1.5">
       <div className="w-8 h-8 bg-printflow-primary-fixed rounded-full flex items-center justify-center shrink-0">
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
       <button
        onClick={requestSignOut}
        className="p-2 rounded-lg text-printflow-on-surface-variant hover:text-printflow-error hover:bg-printflow-error/10 transition-colors"
        aria-label="Sign out"
        title="Sign out"
       >
        <LogOut className="w-5 h-5" />
       </button>
      </div>
    </div>
   </div>
  </header>

  {/* Sign-out confirmation - SweetAlert-style hero. Non-dismissible
      while signing out: must click a button to close. */}
  <Modal
   isOpen={signOutOpen}
   onClose={cancelSignOut}
   title=""
   size="sm"
   closeOnOverlayClick={!signingOut}
   dismissible={!signingOut}
   footer={
    <div className="flex gap-2.5 w-full">
     <Button
      variant="secondary"
      onClick={cancelSignOut}
      className="flex-1 py-3"
      disabled={signingOut}
     >
      Cancel
     </Button>
     <Button
      variant="danger"
      onClick={handleSignOut}
      className="flex-[2] py-3 shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
      loading={signingOut}
      disabled={signingOut}
     >
      <LogOut className="w-4 h-4 mr-2" />
      {signingOut ? "Signing out..." : "Yes, sign out"}
     </Button>
    </div>
   }
  >
   <div className="flex flex-col items-center text-center px-2 py-2">
    <span className="flex items-center justify-center w-[84px] h-[84px] rounded-full bg-printflow-error-container/60">
     <span className="flex items-center justify-center w-[60px] h-[60px] rounded-full bg-printflow-error-container">
      <LogOut className="w-7 h-7 text-printflow-on-error-container" />
     </span>
    </span>
    <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-printflow-on-surface">
      Sign out of Brialyns Art Sign?
    </h3>
    <p className="mt-1.5 text-sm leading-relaxed text-printflow-on-surface-variant max-w-xs">
     You&apos;ll need to sign in again to access orders, inventory, and the
     rest of the workspace.
    </p>
    {displayEmail && (
     <div className="mt-4 px-4 py-2 rounded-full bg-printflow-surface-container border border-printflow-outline-variant/50 text-[13px] text-printflow-on-surface-variant">
      Signed in as{" "}
      <span className="font-semibold text-printflow-on-surface">
       {displayEmail}
      </span>
     </div>
    )}
   </div>
  </Modal>
  </>
 );
}

"use client";

import { useEffect, useRef, useState, useCallback, ReactNode } from "react";
import {
  Bell,
  Search,
  User,
  LogOut,
  Moon,
  Sun,
  Package,
  AlertTriangle,
  Banknote,
  WifiOff,
  Clock,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Modal, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useFeedStatus } from "@/lib/useFeedStatus";
import { subscribeOrders } from "@/lib/services/orders";
import { subscribeInventory } from "@/lib/services/inventory";
import { subscribeUsageEvents } from "@/lib/services/usage";
import { subscribeUsers } from "@/lib/services/users";
import { subscribeSensors, type SensorState } from "@/lib/services/rfid";
import { isLocalActivity } from "@/lib/live-activity";
import { bumpTabBadge, clearTabBadge } from "@/lib/tab-badge";
import {
  appendActivityFeed,
  diffInventory,
  diffOrders,
  diffSensors,
  diffUsage,
  diffUsers,
  getActivityFeed,
  type InventoryState,
  type LiveEvent,
  type LiveTone,
  type OrderState,
  type SensorSnapshot,
  type StockChange,
} from "@/lib/live-activity-diff";
import { getInventoryStatus, getPriority } from "@/lib/derived";
import type { Order, InventoryItem, User as UserType } from "@/types";

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
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();

  // ---- live activity (toasts + bell feed for every real change) -------
  const prevOrders = useRef<Map<string, OrderState>>(new Map());
  const prevInventory = useRef<Map<string, InventoryState>>(new Map());
  const prevSensors = useRef<Map<string, SensorSnapshot>>(new Map());
  const prevUsers = useRef<Map<string, string>>(new Map());
  const seenUsage = useRef<Set<string>>(new Set());
  // Variant ids touched by a usage event recently - the matching stock
  // change is already announced by that event.
  const usageTouched = useRef<Map<string, number>>(new Map());
  // Stock changes are buffered briefly so the matching usage event can
  // claim the toast even when the two snapshots arrive out of order.
  const stockBuffer = useRef<Map<string, StockChange>>(new Map());
  const stockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // First snapshot per feed only primes the "previous" maps - a page
  // load must not announce the whole backlog.
  const hydrated = useRef({
    orders: false,
    inventory: false,
    sensors: false,
    usage: false,
    users: false,
  });
  const usersRef = useRef<UserType[]>([]);
  const desktopRef = useRef<string>("unsupported");
  const [activity, setActivity] = useState<LiveEvent[]>(() => getActivityFeed());
  const [desktopAlerts, setDesktopAlerts] = useState<string>("unsupported");

  useEffect(() => {
   setMounted(true);
   setTheme(readStoredTheme());
   if (typeof window !== "undefined" && "Notification" in window) {
    desktopRef.current = Notification.permission;
    setDesktopAlerts(Notification.permission);
   }
  }, []);

  // Keep the roster mirror fresh without re-subscribing on user changes.
  useEffect(() => {
   usersRef.current = allUsers;
  }, [allUsers]);

  // Feed errors surface as a dropdown row (with retry) instead of a
  // silently empty bell.
  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  const emitLive = useCallback(
   (events: LiveEvent[]) => {
    if (events.length === 0) return;
    // Bell feed: newest first, capped, kept module-side so it survives
    // header remounts during navigation.
    setActivity(appendActivityFeed(events));
    // Toasts + desktop alerts, capped per batch so a burst (e.g. an
    // auto-deduct touching several materials) never floods the screen.
    const alerts = events.filter((e) => e.alert).slice(0, 3);
    const hidden =
     typeof document !== "undefined" && document.hidden;
    for (const e of alerts) {
     const push =
      e.tone === "error"
       ? toast.error
       : e.tone === "success"
       ? toast.success
       : toast.info;
     push(e.detail, e.title);
     if (desktopRef.current === "granted" && hidden) {
      try {
       new Notification(e.title, {
        body: e.detail,
        icon: "/logo.jpg",
        tag: e.id,
       });
      } catch {
       // OS-level notifications can fail; the toast already covered it.
      }
     }
    }
    // Background tab: Facebook-style badge on the title + favicon so the
    // changes are visible from the tab strip itself.
    if (hidden && alerts.length > 0) {
     bumpTabBadge(alerts.length);
    }
   },
   [toast],
  );

  const flushStockBuffer = useCallback(() => {
   stockTimer.current = null;
   const pending = stockBuffer.current;
   stockBuffer.current = new Map();
   if (pending.size === 0) return;
   const now = Date.now();
   const events: LiveEvent[] = [];
   for (const ch of pending.values()) {
    const touchedAt = usageTouched.current.get(ch.materialVariantId);
    // Covered by a usage / auto-deduct toast from the same movement.
    if (touchedAt !== undefined && now - touchedAt < 12000) continue;
    events.push({
     id: `evt-stock-${ch.materialVariantId}-${now}`,
     tone: ch.to < ch.from ? "warning" : "success",
     title: `Stock adjusted: ${ch.materialVariantId}`,
     detail: `${ch.itemType} - ${ch.from} -> ${ch.to}`,
     href: "/inventory",
     alert: !isLocalActivity("inventory", ch.materialVariantId),
     at: now,
    });
   }
   emitLive(events);
  }, [emitLive]);

  useEffect(() => {
   const unsubOrders = subscribeOrders((rows) => {
    const { events, next } = diffOrders(prevOrders.current, rows);
    prevOrders.current = next;
    setOrders(rows);
    if (hydrated.current.orders) emitLive(events);
    else hydrated.current.orders = true;
   }, onFeedError);

   const unsubInv = subscribeInventory((rows) => {
    const { events, stockChanges, next } = diffInventory(
     prevInventory.current,
     rows,
    );
    prevInventory.current = next;
    setInventory(rows);
    if (!hydrated.current.inventory) {
     hydrated.current.inventory = true;
     return;
    }
    emitLive(events);
    if (stockChanges.length > 0) {
     for (const ch of stockChanges) {
      stockBuffer.current.set(ch.materialVariantId, ch);
     }
     if (!stockTimer.current) {
      stockTimer.current = setTimeout(flushStockBuffer, 1200);
     }
    }
   }, onFeedError);

   const unsubSensors = subscribeSensors(
    (sensors: Record<string, SensorState>) => {
     const { events, next } = diffSensors(prevSensors.current, sensors);
     prevSensors.current = next;
     if (hydrated.current.sensors) emitLive(events);
     else hydrated.current.sensors = true;
    },
    onFeedError,
   );

   const unsubUsage = subscribeUsageEvents(
    (rows) => {
     const { events, touchVariants, autoDeduct, next } = diffUsage(
      seenUsage.current,
      rows,
      (uid) => usersRef.current.find((u) => u.id === uid)?.name ?? null,
     );
     seenUsage.current = next;
     const now = Date.now();
     for (const v of touchVariants) usageTouched.current.set(v, now);
     if (!hydrated.current.usage) {
      hydrated.current.usage = true;
      return;
     }
     if (autoDeduct.count > 0 && autoDeduct.anyAlert) {
      events.push({
       id: `evt-autodeduct-${now}`,
       tone: "info",
       title: `Auto-deduct: ${autoDeduct.count} material${autoDeduct.count === 1 ? "" : "s"}`,
       detail: autoDeduct.orderId
        ? `Order ${autoDeduct.orderId} entered production`
        : "Recipe deducted for a production order",
       href: "/production",
       alert: true,
       at: now,
      });
     }
     emitLive(events);
    },
    100,
    onFeedError,
   );

   const unsubUsers = subscribeUsers((rows) => {
    const { events, next } = diffUsers(prevUsers.current, rows);
    prevUsers.current = next;
    setAllUsers(rows);
    if (hydrated.current.users) emitLive(events);
    else hydrated.current.users = true;
   }, onFeedError);

   return () => {
    unsubOrders();
    unsubInv();
    unsubSensors();
    unsubUsage();
    unsubUsers();
    if (stockTimer.current) {
     clearTimeout(stockTimer.current);
     stockTimer.current = null;
    }
   };
  }, [feedNonce, onFeedError, emitLive, flushStockBuffer]);

  const enableDesktopAlerts = async () => {
   if (typeof window === "undefined" || !("Notification" in window)) return;
   try {
    const permission = await Notification.requestPermission();
    desktopRef.current = permission;
    setDesktopAlerts(permission);
   } catch {
    // Prompt dismissed - nothing to do.
   }
  };

  // Close the notifications dropdown on Escape.
  useEffect(() => {
   if (!notificationsOpen) return;
   const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setNotificationsOpen(false);
   };
   window.addEventListener("keydown", onKey);
   return () => window.removeEventListener("keydown", onKey);
  }, [notificationsOpen]);

  // Returning to the tab counts as "seen": drop the title/favicon badge.
  useEffect(() => {
   const onVisibility = () => {
    if (!document.hidden) clearTabBadge();
   };
   document.addEventListener("visibilitychange", onVisibility);
   return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

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

   // 6-7. Stock movements and new orders are NOT duplicated here - the
   // "Live activity" feed already raises a row (and toast) for every
   // usage event and new order. This list keeps state-based alerts only.

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

  // Live activity rows - every real change (app actions, other admins,
  // other tabs) - rendered on top of the derived alerts. Dismissals use
  // the same localStorage set.
  const toneIcon: Record<LiveTone, typeof Package> = {
   success: CheckCircle2,
   warning: AlertTriangle,
   error: AlertTriangle,
   info: Info,
  };
  const toneAccent: Record<LiveTone, string> = {
   success: "text-printflow-success",
   warning: "text-printflow-warning",
   error: "text-printflow-error",
   info: "text-printflow-primary",
  };
  const activityRows: HeaderNotification[] = activity
   .filter((e) => !dismissed.has(e.id))
   .map((e) => ({
    id: e.id,
    icon: toneIcon[e.tone],
    accent: toneAccent[e.tone],
    title: e.title,
    detail: e.detail,
    meta: timeAgo(new Date(e.at).toISOString()),
    href: e.href,
   }));
  const feed: HeaderNotification[] = [...activityRows, ...notifications];

  const clearAllNotifications = () => {
   const ids = feed.map((n) => n.id);
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
        onClick={() => {
         const next = !notificationsOpen;
         setNotificationsOpen(next);
         if (next) clearTabBadge();
        }}
        className="btn-ghost p-2 relative"
        aria-label={
         feed.length > 0
          ? `Notifications, ${feed.length} new`
          : "Notifications"
        }
        aria-expanded={notificationsOpen}
       >
        <Bell className="w-5 h-5" />
        {feed.length > 0 && (
         <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-printflow-error text-white text-[10px] font-bold flex items-center justify-center">
          {feed.length > 9 ? "9+" : feed.length}
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
             {feed.length === 0 ? "caught up" : `${feed.length} new`}
            </span>
            {desktopAlerts === "default" && (
             <button
              type="button"
              onClick={() => void enableDesktopAlerts()}
              className="text-xs font-medium text-printflow-primary hover:underline focus:outline-none focus:ring-2 focus:ring-printflow-primary rounded px-1"
              title="Also show OS notifications when this tab is in the background"
             >
              Desktop alerts
             </button>
            )}
            {feed.length > 0 && (
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
           {feed.length === 0 && !feedError ? (
            <div className="px-4 py-8 text-center text-sm text-printflow-on-surface-variant">
             You&apos;re all caught up.
            </div>
           ) : feed.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-printflow-on-surface-variant">
             No notifications to show.
            </div>
           ) : (
            feed.map((n, idx) => {
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

/**
 * Live-activity diffing for the header's notification centre.
 *
 * The header subscribes to orders / inventory / sensors / usage_events /
 * users and compares each snapshot against the previous one. Every real
 * change becomes a `LiveEvent`:
 *   - `alert: true`  -> toast + optional desktop notification
 *   - `alert: false` -> bell feed row only (coalesced sub-events)
 *
 * Pure functions, so the behaviour is easy to reason about: the caller
 * owns the "previous snapshot" maps and the local-write suppression
 * (`isLocalActivity`) lives in the service layer.
 */
import { isLocalActivity } from "@/lib/live-activity";
import type { SensorState } from "@/lib/services/rfid";
import type { InventoryItem, Order, UsageEvent, User } from "@/types";

export type LiveTone = "success" | "warning" | "error" | "info";

export interface LiveEvent {
  id: string;
  tone: LiveTone;
  title: string;
  detail: string;
  href: string;
  /** Also raise a toast (and desktop alert). False = bell feed only. */
  alert: boolean;
  /** Client epoch ms - drives the "x minutes ago" meta. */
  at: number;
}

// ---- session activity feed ----------------------------------------------
// Module-scoped so the feed survives the header remounting on every page
// navigation (each page renders its own AdminLayout -> Header). Resets on
// a hard reload; the permanent record lives on the Audit page.

const FEED_CAP = 25;
let activityFeed: LiveEvent[] = [];

export function getActivityFeed(): LiveEvent[] {
  return activityFeed;
}

/** Prepend events (newest first), capped. Returns the new feed. */
export function appendActivityFeed(events: LiveEvent[]): LiveEvent[] {
  if (events.length > 0) {
    activityFeed = [...events]
      .reverse()
      .concat(activityFeed)
      .slice(0, FEED_CAP);
  }
  return activityFeed;
}

// ---- orders ----

export interface OrderState {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
}

export function diffOrders(
  prev: Map<string, OrderState>,
  rows: Order[],
): { events: LiveEvent[]; next: Map<string, OrderState> } {
  const events: LiveEvent[] = [];
  const next = new Map<string, OrderState>();
  const now = Date.now();
  for (const o of rows) {
    const state: OrderState = {
      status: o.status,
      paymentStatus: o.payment_status ?? "",
      paymentMethod: o.payment_method ?? "",
    };
    const before = prev.get(o.order_id);
    if (!before) {
      events.push({
        id: `evt-order-new-${o.order_id}`,
        tone: "success",
        title: "New order received",
        detail: `${o.order_id} - ${o.customer_name} (${o.item_type} x${o.quantity})`,
        href: "/orders",
        alert: !isLocalActivity("order", o.order_id),
        at: now,
      });
    } else {
      if (before.status !== state.status) {
        const cancelled = state.status === "Cancelled";
        events.push({
          id: `evt-order-status-${o.order_id}-${state.status}-${now}`,
          tone: cancelled ? "error" : "info",
          title: cancelled
            ? "Order cancelled"
            : `Order ${o.order_id}: ${before.status} -> ${state.status}`,
          detail: `${o.customer_name} - ${o.item_type} x${o.quantity}`,
          href: cancelled ? "/orders" : "/production",
          alert: !isLocalActivity("order", o.order_id),
          at: now,
        });
      }
      if (
        before.paymentStatus !== state.paymentStatus ||
        before.paymentMethod !== state.paymentMethod
      ) {
        events.push({
          id: `evt-order-payment-${o.order_id}-${now}`,
          tone: "success",
          title: "Payment updated",
          detail: `${o.order_id} - ${state.paymentStatus || "Unpaid"}${
            state.paymentMethod ? ` via ${state.paymentMethod}` : ""
          }`,
          href: "/sales",
          alert: !isLocalActivity("order", o.order_id),
          at: now,
        });
      }
    }
    next.set(o.order_id, state);
  }
  return { events, next };
}

// ---- inventory ----

export interface InventoryState {
  stock: number;
  rop: number;
}

export interface StockChange {
  materialVariantId: string;
  itemType: string;
  from: number;
  to: number;
}

export function diffInventory(
  prev: Map<string, InventoryState>,
  rows: InventoryItem[],
): {
  events: LiveEvent[];
  /** Stock diffs are returned separately: the caller buffers them for a
   *  moment so the matching usage event can claim the toast instead. */
  stockChanges: StockChange[];
  next: Map<string, InventoryState>;
} {
  const events: LiveEvent[] = [];
  const stockChanges: StockChange[] = [];
  const next = new Map<string, InventoryState>();
  const now = Date.now();
  for (const it of rows) {
    const id = it.material_variant_id;
    const state: InventoryState = { stock: it.current_stock, rop: it.reorder_point };
    const before = prev.get(id);
    if (!before) {
      events.push({
        id: `evt-item-new-${id}-${now}`,
        tone: "info",
        title: "Material added",
        detail: `${id} - ${it.item_type} (stock ${it.current_stock}, ROP ${it.reorder_point})`,
        href: "/inventory",
        alert: false,
        at: now,
      });
    } else {
      if (before.stock !== state.stock) {
        stockChanges.push({
          materialVariantId: id,
          itemType: it.item_type,
          from: before.stock,
          to: state.stock,
        });
      }
      if (before.rop !== state.rop) {
        events.push({
          id: `evt-rop-${id}-${now}`,
          tone: "info",
          title: "Reorder point updated",
          detail: `${id} - ${it.item_type} (${before.rop} -> ${state.rop})`,
          href: "/inventory",
          alert: !isLocalActivity("inventory", id),
          at: now,
        });
      }
    }
    next.set(id, state);
  }
  for (const [id, before] of prev) {
    if (!next.has(id)) {
      events.push({
        id: `evt-item-del-${id}-${now}`,
        tone: "warning",
        title: "Material removed",
        detail: `${id} (stock was ${before.stock})`,
        href: "/inventory",
        alert: false,
        at: now,
      });
    }
  }
  return { events, stockChanges, next };
}

// ---- sensors ----

export interface SensorSnapshot {
  online: boolean;
  mode: string;
}

export function diffSensors(
  prev: Map<string, SensorSnapshot>,
  sensors: Record<string, SensorState>,
): { events: LiveEvent[]; next: Map<string, SensorSnapshot> } {
  const events: LiveEvent[] = [];
  const next = new Map<string, SensorSnapshot>();
  const now = Date.now();
  for (const [id, s] of Object.entries(sensors)) {
    const state: SensorSnapshot = { online: s.online, mode: s.tapMode ?? "" };
    const before = prev.get(id);
    // A sensor appearing for the first time is setup, not news.
    if (!before) {
      next.set(id, state);
      continue;
    }
    const local = isLocalActivity("sensor", id);
    if (before.online !== state.online) {
      events.push({
        id: `evt-sensor-${id}-${state.online ? "on" : "off"}-${now}`,
        tone: state.online ? "success" : "warning",
        title: `Sensor ${id} ${state.online ? "online" : "offline"}`,
        detail: "ESP32 station status changed",
        href: "/inventory",
        alert: !local,
        at: now,
      });
    }
    if (before.mode !== state.mode) {
      events.push({
        id: `evt-sensor-mode-${id}-${now}`,
        tone: "info",
        title: `Sensor ${id} mode changed`,
        detail: `${before.mode || "-"} -> ${state.mode}`,
        href: "/inventory",
        alert: !local,
        at: now,
      });
    }
    next.set(id, state);
  }
  return { events, next };
}

// ---- usage events ----

export interface UsageBatch {
  count: number;
  orderId: string | null;
  /** True when at least one auto-deduct was NOT initiated by this tab. */
  anyAlert: boolean;
}

export function diffUsage(
  seen: Set<string>,
  rows: UsageEvent[],
  resolveActor: (uid?: string | null) => string | null,
): {
  events: LiveEvent[];
  /** Variant ids touched by this batch - lets the inventory buffer know
   *  a stock change is already covered by a usage toast. */
  touchVariants: string[];
  autoDeduct: UsageBatch;
  next: Set<string>;
} {
  const events: LiveEvent[] = [];
  const touchVariants: string[] = [];
  const next = new Set<string>();
  const now = Date.now();
  let count = 0;
  let orderId: string | null = null;
  let anyAlert = false;

  for (const u of rows) {
    const id = u.id ?? `${u.material_variant_id}-${u.timestamp ?? ""}`;
    next.add(id);
    if (seen.has(id)) continue;

    touchVariants.push(u.material_variant_id);
    const local = isLocalActivity("inventory", u.material_variant_id);
    const actor = resolveActor(u.by_uid);
    const actorText = actor ? ` by ${actor}` : "";

    if (u.source === "auto-deduct") {
      count += 1;
      if (!orderId && u.order_id) orderId = u.order_id;
      if (!local) anyAlert = true;
      events.push({
        id: `evt-usage-${id}`,
        tone: "info",
        title: `Auto-deduct -${u.qty} ${u.material_variant_id}`,
        detail: u.order_id ? `Order ${u.order_id}` : "Recipe deduction",
        href: "/inventory",
        alert: false,
        at: now,
      });
      continue;
    }

    if (u.direction === "in") {
      events.push({
        id: `evt-usage-${id}`,
        tone: "success",
        title: `Stock in +${u.qty} ${u.material_variant_id}`,
        detail: [u.reason, actor ? `by ${actor}` : null].filter(Boolean).join(" - ") ||
          `Received${actorText}`,
        href: "/inventory",
        alert: !local,
        at: now,
      });
    } else {
      events.push({
        id: `evt-usage-${id}`,
        tone: "warning",
        title: `Usage -${u.qty} ${u.material_variant_id}`,
        detail:
          [u.reason ?? u.source, u.order_id ? `order ${u.order_id}` : null]
            .filter(Boolean)
            .join(" - ") + actorText,
        href: "/inventory",
        alert: !local,
        at: now,
      });
    }
  }

  return {
    events,
    touchVariants,
    autoDeduct: { count, orderId, anyAlert },
    next,
  };
}

// ---- users (sign-ins) ----

export function diffUsers(
  prev: Map<string, string>,
  rows: User[],
): { events: LiveEvent[]; next: Map<string, string> } {
  const events: LiveEvent[] = [];
  const next = new Map<string, string>();
  const now = Date.now();
  for (const u of rows) {
    // `lastLogin` may arrive as an ISO string or a Firestore Timestamp.
    const raw = u.lastLogin;
    const signedInAt =
      typeof raw === "string"
        ? raw
        : raw && typeof raw === "object" && "toDate" in raw
        ? raw.toDate().toISOString()
        : "";
    const before = prev.get(u.id);
    if (before !== undefined && before !== signedInAt && signedInAt) {
      events.push({
        id: `evt-login-${u.id}-${now}`,
        tone: "info",
        title: `${u.name || u.email} signed in`,
        detail: `${u.role} - ${u.email}`,
        href: "/users",
        alert: false,
        at: now,
      });
    }
    next.set(u.id, signedInAt);
  }
  return { events, next };
}

/**
 * Domain helpers - pure functions computed live from `Date.now()` so
 * the priority / ETA chips update as the clock advances.
 */

import type { Order, InventoryItem } from "@/types";

/** Days from `now` to `targetDateIso` (negative = overdue). */
function daysUntil(iso: string, now: Date): number {
  const target = new Date(iso).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);
  return Math.round((targetDay.getTime() - today) / (1000 * 60 * 60 * 24));
}

/** Priority: Overdue | Urgent | Upcoming. */
export function getPriority(order: Order, now: Date = new Date()): Order["priority"] {
  const d = daysUntil(order.target_date, now);
  if (d < 0) return "Overdue";
  if (d <= 2) return "Urgent";
  return "Upcoming";
}

/**
 * ETA: kept for the create-time default only. Read paths use
 * {@link getLiveETA} so the date tracks the live queue.
 */
export function getETA(
  order: Order,
  now: Date = new Date(),
): { iso: string; basedOn: string[] } {
  // Prefer the stored fields - they were computed at create-time using the
  // server's now().
  if (order.estimated_completion) {
    return {
      iso: order.estimated_completion,
      basedOn: order.based_on ?? [],
    };
  }
  // Fallback (shouldn't happen in normal flow): +2 days from target.
  // Empty basedOn (no live signals) - never an out-of-vocab placeholder.
  const target = new Date(order.target_date);
  target.setDate(target.getDate() + 2);
  return { iso: target.toISOString().slice(0, 10), basedOn: [] };
}

/** Active (unfinished) statuses - the backlog that delays an order. */
export function isActiveStatus(status: string): boolean {
  return (
    status === "Pending" ||
    status === "In Production" ||
    status === "Ready for Pickup"
  );
}

/**
 * Cold-start daily throughput (units/day) used when no completion
 * history exists yet. Documented assumption, not a measurement -
 * `capacity` is omitted from `basedOn` in that case.
 */
export const FALLBACK_DAILY_UNITS = 10;

/**
 * Live backlog-based ETA (Title 1 objective 9).
 *
 *   rank        = order's position in the priority-sorted active queue
 *   unitsAhead  = quantities of all active orders ahead of it
 *   rate        = completed units/day over the last 7 days (or the
 *                 cold-start fallback when there is no history)
 *   etaDays     = ceil((unitsAhead + ownQty) / rate), minimum 1
 *   ETA         = today + etaDays
 *
 * `basedOn` is honest about which signals were live: `backlog` always,
 * `capacity` only with real completion history, `job_complexity` only
 * when the order is bigger than the median active order.
 */
export function getLiveETA(
  order: Order,
  active: Order[],
  historyUnitsPerDay: number,
  now: Date = new Date(),
): { iso: string; basedOn: Order["based_on"] } {
  const ranked = [...active].sort(
    (a, b) =>
      priorityWeight(getPriority(a, now)) -
        priorityWeight(getPriority(b, now)) ||
      a.target_date.localeCompare(b.target_date) ||
      (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  const rank = Math.max(
    0,
    ranked.findIndex(
      (o) => (o.id ?? o.order_id) === (order.id ?? order.order_id),
    ),
  );
  const unitsAhead = ranked
    .slice(0, rank)
    .reduce((s, o) => s + Math.max(0, o.quantity ?? 0), 0);
  const ownQty = Math.max(1, order.quantity ?? 0);
  const hasHistory = historyUnitsPerDay > 0;
  const rate = hasHistory ? historyUnitsPerDay : FALLBACK_DAILY_UNITS;
  const etaDays = Math.max(1, Math.ceil((unitsAhead + ownQty) / rate));
  const d = new Date(now);
  d.setDate(d.getDate() + etaDays);
  const qtys = active
    .map((o) => o.quantity ?? 0)
    .sort((a, b) => a - b);
  const median =
    qtys.length === 0 ? 0 : qtys[Math.floor(qtys.length / 2)];
  const basedOn: NonNullable<Order["based_on"]> = ["backlog"];
  if (hasHistory) basedOn.push("capacity");
  if (qtys.length > 0 && ownQty > median) basedOn.push("job_complexity");
  return { iso: d.toISOString().slice(0, 10), basedOn };
}

/** Completed units in the trailing 7 days (throughput signal). */
export function completedUnitsLast7d(
  orders: Order[],
  now: Date = new Date(),
): number {
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return orders
    .filter(
      (o) =>
        o.status === "Completed" &&
        o.completed_at !== undefined &&
        new Date(o.completed_at) >= start,
    )
    .reduce((s, o) => s + Math.max(0, o.quantity ?? 0), 0);
}

/** Inventory status derived from current_stock vs reorder_point. */
export function getInventoryStatus(item: InventoryItem): InventoryItem["status"] {
  if (item.current_stock <= Math.floor(item.reorder_point * 0.6)) {
    return "Insufficient Stock";
  }
  if (item.current_stock <= item.reorder_point) {
    return "Low Stock";
  }
  return "In Stock";
}

/** True if lastCheckoutAt is older than 12 h. */
export function isStale(
  item: InventoryItem,
  now: Date = new Date(),
): boolean {
  if (!item.lastCheckoutAt) return false;
  const last = new Date(item.lastCheckoutAt).getTime();
  return now.getTime() - last > 12 * 60 * 60 * 1000;
}

/** Order priority weight for sorting. */
export function priorityWeight(p: Order["priority"]): number {
  return p === "Overdue" ? 0 : p === "Urgent" ? 1 : 2;
}

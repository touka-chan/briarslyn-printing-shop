/**
 * Domain helpers — pure functions for the things the codebase used to
 * compute at read-time from `mockData.TODAY`. Now they use `Date.now()` so
 * the priority / ETA chips update live as the clock advances.
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
 * ETA: derived from the order's stored fields. The client stores both the
 * estimated completion date and the `based_on` array at create time, so
 * this helper exists mostly for the read-side (and the create-time writer
 * uses it too). Returns { iso, basedOn } so the UI can show "ETA: 2 days,
 * based on backlog + job_complexity + capacity".
 */
export function getETA(
  order: Order,
  now: Date = new Date(),
): { iso: string; basedOn: string[] } {
  // Prefer the stored fields — they were computed at create-time using the
  // server's now().
  if (order.estimated_completion) {
    return {
      iso: order.estimated_completion,
      basedOn: order.based_on ?? [],
    };
  }
  // Fallback (shouldn't happen in normal flow): +2 days from target.
  const target = new Date(order.target_date);
  target.setDate(target.getDate() + 2);
  return { iso: target.toISOString().slice(0, 10), basedOn: ["fallback"] };
}

/** Inventory status derived from current_stock vs reorder_point vs threshold. */
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

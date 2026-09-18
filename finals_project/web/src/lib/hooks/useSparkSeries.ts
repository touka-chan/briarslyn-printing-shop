/**
 * useSparkSeries - bucket timestamped records into a `days`-long series for
 * sparkline rendering. Pure time-bucketing: it doesn't care what the records
 * are (orders, inventory checkouts, users) as long as you can hand it a
 * timestamp fn.
 *
 * Output: a fixed-length `number[]` ending on today, length = `days`.
 *   - index 0      = oldest day (today - days + 1)
 *   - last index   = today (local time)
 *
 * Why local YYYY-MM-DD keys: UTC would re-bucket records around midnight
 * (e.g. an 11pm-PHT checkout becomes "tomorrow" in UTC), which breaks the
 * UX of "today's count" on a Manila dashboard.
 */
"use client";

import { useMemo } from "react";

/** Local-time day key - strips the time component and uses the user's TZ. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Short label like "Aug 30" for tooltips. */
export function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/**
 * Returns an array of the `days` most-recent local YYYY-MM-DD keys, ending
 * on `now`'s day. Used both as the iteration set and as lookup keys.
 */
export function dayKeysEndingToday(days: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

/** Day-key - count map for any iterable of records. */
export function countPerDay<T>(
  items: Iterable<T>,
  getKey: (item: T) => string | undefined,
  days: number,
  now: Date = new Date(),
): number[] {
  const keys = dayKeysEndingToday(days, now);
  const counts = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const item of items) {
    const raw = getKey(item);
    if (!raw) continue;
    const k = raw.slice(0, 10); // accept full ISO or already-trimmed
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return keys.map((k) => counts.get(k) ?? 0);
}

/**
 * Hook form. Reactively recomputes the series whenever the source array
 * changes (Firebase onSnapshot calls return a new array each tick).
 */
export function useSparkSeries<T>(
  items: T[] | undefined | null,
  getKey: (item: T) => string | undefined,
  days = 7,
  now: Date = new Date(),
): number[] {
  return useMemo(
    () => countPerDay(items ?? [], getKey, days, now),
    [items, getKey, days, now],
  );
}

/* ------------------------------------------------------------------ *
 * Convenience: bucketing fns per collection.                          *
 * Pages don't need to write these inline - import the one that fits.  *
 * ------------------------------------------------------------------ */

/** Order: bucket by `created_at` (ISO). */
export const orderCreatedAtKey = (o: { created_at?: string }): string | undefined =>
  o.created_at;

/** Order: bucket by `target_date` (YYYY-MM-DD). */
export const orderTargetDateKey = (o: { target_date?: string }): string | undefined =>
  o.target_date;

/** Inventory item: bucket by `last_checkout_at` (ISO). */
export const inventoryCheckoutKey = (i: {
  lastCheckoutAt?: string;
}): string | undefined => i.lastCheckoutAt;

/** RFID event: bucket by `timestamp` (ISO). */
export const rfidTimestampKey = (e: { timestamp?: string }): string | undefined =>
  e.timestamp;

/** Employee: bucket by `created_at` (ISO). */
export const employeeCreatedAtKey = (e: {
  created_at?: string;
}): string | undefined => e.created_at;

/** User: bucket by `lastLogin` (ISO). */
export const userLastLoginKey = (u: {
  lastLogin?: string | { toDate: () => Date } | null;
}): string | undefined => {
  const v = u.lastLogin;
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object" && "toDate" in v) {
    try {
      return v.toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
};

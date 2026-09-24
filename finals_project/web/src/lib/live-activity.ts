/**
 * Short-lived, in-memory marks for changes THIS web session just made.
 *
 * The Header's live-activity diff watches Firestore and raises toasts
 * for changes made anywhere (mobile POS, other admins, another tab).
 * Without marks, a status change made in this very tab would raise a
 * SECOND toast on top of the page's own confirmation.
 *
 * Marks expire after 5 seconds and never leave the tab. The bell feed
 * still records every change - only the duplicate toast is suppressed.
 */
export type ActivityKind = "order" | "inventory" | "sensor";

const MARKS = new Map<string, number>();
const DEFAULT_WINDOW_MS = 5000;
const key = (kind: ActivityKind, id: string) => `${kind}:${id}`;

/** Remember that this session just changed `kind:id`. */
export function markLocalActivity(kind: ActivityKind, id: string): void {
  const now = Date.now();
  MARKS.set(key(kind, id), now);
  // Opportunistic cleanup so the map never grows unbounded.
  if (MARKS.size > 200) {
    for (const [k, t] of MARKS) {
      if (now - t > 15000) MARKS.delete(k);
    }
  }
}

/** True when this session changed `kind:id` within the last `windowMs`. */
export function isLocalActivity(
  kind: ActivityKind,
  id: string,
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  const t = MARKS.get(key(kind, id));
  return t !== undefined && Date.now() - t < windowMs;
}

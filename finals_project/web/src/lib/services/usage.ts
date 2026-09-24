/**
 * Firestore service - stock movement engine (`bom` + `usage_events`).
 *
 * Web mirror of `mobile_app/lib/services/usage_service.dart`. Three
 * movement kinds, one immutable audit collection:
 *   - auto-deduct - a confirmed order (Pending - In Production) consumes
 *     its recipe (BOM). Locked to the order id via `stock_deducted`.
 *   - manual - stock IN (delivery received) or OUT (wastage/sample/
 *     correction) logged by staff with an optional reason/order link.
 *   - rfid - station taps (stock-in, check-in). Taps never move stock
 *     by themselves.
 *
 * Every movement runs in a Firestore transaction: stock change +
 * status recompute (web `getInventoryStatus` rule) + audit entry commit
 * atomically. Shortfalls floor at zero with a `shortfall` flag.
 */
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
  Timestamp,
  runTransaction,
  type Unsubscribe,
} from "firebase/firestore";
import { requireDb } from "@/lib/firebase";
import { logAudit } from "@/lib/services/audit";
import { markLocalActivity } from "@/lib/live-activity";
import type { Bom, InventoryItem, UsageEvent } from "@/types";
import { getInventoryStatus } from "@/lib/derived";

/** MUST match `normalizeItemType` in mobile `models/bom.dart`. */
export function normalizeItemType(itemType: string): string {
  return itemType.toLowerCase().trim().replace(/\s+/g, "_");
}

/** Firestore subscription failure handler (permission/offline). */
export type FeedErrorHandler = (e: unknown) => void;

function logFeedError(scope: string): FeedErrorHandler {
  return (e) => {
    console.error(`[${scope}] subscription failed:`, e);
  };
}

/** Subscribe to the usage audit log, newest first. */
export function subscribeUsageEvents(
  cb: (events: UsageEvent[]) => void,
  max = 500,
  onError: FeedErrorHandler = logFeedError("usage"),
): Unsubscribe {
  const q = query(
    collection(requireDb(), "usage_events"),
    orderBy("timestamp", "desc"),
    limit(max),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => fromFirestore(d.id, d.data())));
  }, onError);
}

/**
 * Read an order's deduction flag (double-count guard for manual logs
 * linked to an order). Returns null when the order doesn't exist.
 */
export async function fetchOrderHeader(
  orderId: string,
): Promise<{ exists: true; stock_deducted: boolean } | null> {
  const snap = await getDoc(doc(requireDb(), "orders", orderId));
  if (!snap.exists()) return null;
  return {
    exists: true,
    stock_deducted: (snap.data().stock_deducted as boolean) === true,
  };
}

/** Read one recipe by order item_type. Null when unmapped. */
export async function fetchBom(itemType: string): Promise<Bom | null> {
  const snap = await getDoc(
    doc(requireDb(), "bom", normalizeItemType(itemType)),
  );
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    item_type: itemType,
    lines: ((data.lines as Bom["lines"]) ?? []).filter(
      (l) => l && typeof l.material_variant_id === "string",
    ),
  };
}

/** Whole units consumed for an order quantity (rounded UP per line). */
export function consumptionFor(
  bom: Bom,
  orderQty: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of bom.lines) {
    if (!line || line.qty_per_unit <= 0) continue;
    out[line.material_variant_id] =
      (out[line.material_variant_id] ?? 0) +
      Math.ceil(line.qty_per_unit * orderQty);
  }
  return out;
}

export interface MovementResult {
  deltas: Record<string, number>;
  shortfall: boolean;
  skipped: boolean;
}

/** Log a stock IN (delivery received). */
export async function logStockIn(input: {
  materialVariantId: string;
  qty: number;
  note?: string | null;
  byUid?: string | null;
}): Promise<MovementResult> {
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    throw new Error("Quantity must be a positive whole number.");
  }
  const db = requireDb();
  let before: number | null = null;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "inventory", input.materialVariantId);
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error(`Unknown variant: ${input.materialVariantId}`);
    }
    const data = snap.data() as Record<string, unknown>;
    const stock = (data.current_stock as number) ?? 0;
    before = stock;
    const rop = (data.reorder_point as number) ?? 0;
    tx.update(ref, {
      current_stock: stock + input.qty,
      status: getInventoryStatus({
        current_stock: stock + input.qty,
        reorder_point: rop,
      } as InventoryItem),
      last_updated: Timestamp.now(),
    });
    tx.set(doc(collection(db, "usage_events")), {
      material_variant_id: input.materialVariantId,
      qty: input.qty,
      direction: "in",
      source: "manual",
      order_id: null,
      reason: input.note ?? null,
      by_uid: input.byUid ?? null,
      timestamp: Timestamp.now(),
    });
  });
  markLocalActivity("inventory", input.materialVariantId);
  logAudit({
   action: "stock_in",
   module: "inventory",
   record_id: input.materialVariantId,
   record_label: `Material ${input.materialVariantId} (+${input.qty})`,
   old_value: before,
   new_value: before == null ? null : before + input.qty,
  });
  return { deltas: { [input.materialVariantId]: input.qty }, shortfall: false, skipped: false };
}

/** Log a manual stock OUT (wastage/sample/correction/production-use). */
export async function logUsage(input: {
  materialVariantId: string;
  qty: number;
  reason: string;
  orderId?: string | null;
  byUid?: string | null;
}): Promise<MovementResult> {
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    throw new Error("Quantity must be a positive whole number.");
  }
  const db = requireDb();
  let shortfall = false;
  let before: number | null = null;
  let after: number | null = null;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "inventory", input.materialVariantId);
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error(`Unknown variant: ${input.materialVariantId}`);
    }
    const data = snap.data() as Record<string, unknown>;
    const stock = (data.current_stock as number) ?? 0;
    before = stock;
    const rop = (data.reorder_point as number) ?? 0;
    let next = stock - input.qty;
    if (next < 0) {
      shortfall = true;
      next = 0;
    }
    after = next;
    tx.update(ref, {
      current_stock: next,
      status: getInventoryStatus({
        current_stock: next,
        reorder_point: rop,
      } as InventoryItem),
      last_updated: Timestamp.now(),
    });
    tx.set(doc(collection(db, "usage_events")), {
      material_variant_id: input.materialVariantId,
      qty: input.qty,
      direction: "out",
      source: "manual",
      order_id: input.orderId ?? null,
      reason: input.reason,
      shortfall,
      by_uid: input.byUid ?? null,
      timestamp: Timestamp.now(),
    });
  });
  markLocalActivity("inventory", input.materialVariantId);
  logAudit({
   action: "stock_usage",
   module: "inventory",
   record_id: input.materialVariantId,
   record_label: `Material ${input.materialVariantId} (-${input.qty}, ${input.reason})`,
   old_value: before,
   new_value: after,
  });
  return { deltas: { [input.materialVariantId]: -input.qty }, shortfall, skipped: false };
}

/**
 * Auto-deduct an order's recipe. Called when the order enters
 * "In Production". Idempotent via `stock_deducted` (re-checked inside
 * the transaction so concurrent advances can't double-deduct).
 */
export async function autoDeductForOrder(
  orderId: string,
  byUid?: string | null,
): Promise<MovementResult> {
  const db = requireDb();
  const orderRef = doc(db, "orders", orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) throw new Error(`Order not found: ${orderId}`);
  const order = orderSnap.data() as Record<string, unknown>;
  if (order.stock_deducted === true) {
    return { deltas: {}, shortfall: false, skipped: true };
  }
  const itemType = (order.item_type as string) ?? "";
  const orderQty = (order.quantity as number) ?? 0;
  const bom = await fetchBom(itemType);
  if (!bom || orderQty <= 0) {
    return { deltas: {}, shortfall: false, skipped: true };
  }
  const consumption = consumptionFor(bom, orderQty);
  if (Object.keys(consumption).length === 0) {
    return { deltas: {}, shortfall: false, skipped: true };
  }
  let shortfall = false;
  const deltas: Record<string, number> = {};
  const moves: { variantId: string; before: number; after: number }[] = [];
  await runTransaction(db, async (tx) => {
    const fresh = await tx.get(orderRef);
    if ((fresh.data()?.stock_deducted as boolean) === true) return;
    for (const [variantId, qty] of Object.entries(consumption)) {
      const ref = doc(db, "inventory", variantId);
      const snap = await tx.get(ref);
      if (!snap.exists()) continue; // unknown variant: skip line, keep rest
      const data = snap.data() as Record<string, unknown>;
      const stock = (data.current_stock as number) ?? 0;
      const rop = (data.reorder_point as number) ?? 0;
      let next = stock - qty;
      if (next < 0) {
        shortfall = true;
        next = 0;
      }
      moves.push({ variantId, before: stock, after: next });
      tx.update(ref, {
        current_stock: next,
        status: getInventoryStatus({
          current_stock: next,
          reorder_point: rop,
        } as InventoryItem),
        last_updated: Timestamp.now(),
      });
      tx.set(doc(collection(db, "usage_events")), {
        material_variant_id: variantId,
        qty,
        direction: "out",
        source: "auto-deduct",
        order_id: orderId,
        reason: null,
        shortfall,
        by_uid: byUid ?? null,
        timestamp: Timestamp.now(),
      });
      deltas[variantId] = -qty;
    }
    tx.update(orderRef, {
      stock_deducted: true,
      deducted_at: Timestamp.now(),
    });
  });
  for (const m of moves) {
   markLocalActivity("inventory", m.variantId);
   logAudit({
    action: "stock_deducted_auto",
    module: "inventory",
    record_id: m.variantId,
    record_label: `Material ${m.variantId} (auto-deduct for ${orderId})`,
    old_value: m.before,
    new_value: m.after,
   });
  }
  return { deltas, shortfall, skipped: false };
}

// ---- internal helpers ----

function fromFirestore(id: string, data: Record<string, unknown>): UsageEvent {
  return {
    id,
    material_variant_id: (data.material_variant_id as string) ?? "",
    qty: (data.qty as number) ?? 0,
    direction: (data.direction as UsageEvent["direction"]) ?? "out",
    source: (data.source as UsageEvent["source"]) ?? "manual",
    order_id: (data.order_id as string) ?? null,
    reason: (data.reason as string) ?? null,
    by_uid: (data.by_uid as string) ?? null,
    timestamp: fromTimestamp(data.timestamp) ?? new Date().toISOString(),
    shortfall: (data.shortfall as boolean) ?? false,
  };
}

function fromTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

/**
 * Firestore service — inventory collection.
 *
 * Field shape (camelCase ↔ snake_case in Firestore):
 *   materialVariantId    ↔ material_variant_id
 *   itemType             ↔ item_type
 *   tagUid               ↔ tag_uid
 *   sensorId             ↔ sensor_id
 *   currentStock         ↔ current_stock
 *   reorderPoint         ↔ reorder_point
 *   threshold            ↔ threshold
 *   forecastedDemandNext7Days ↔ forecasted_demand_next_7_days
 *   model                ↔ model
 *   status               ↔ status
 *   lastUpdated          ↔ last_updated
 *   lastCheckoutAt       ↔ last_checkout_at
 *
 * RFID check-out writes to the `rfid_events` collection are *not* here — that
 * path is service-account-only (the ESP32 firmware's job), so the web
 * dashboard has no `recordRfidEvent` method.
 */
import {
 collection,
 onSnapshot,
 doc,
 setDoc,
 updateDoc,
 deleteDoc,
 Timestamp,
 type Unsubscribe,
} from "firebase/firestore";
import { requireDb } from "@/lib/firebase";
import type { InventoryItem } from "@/types";
import { getInventoryStatus, isStale } from "@/lib/derived";

const COLL = "inventory";

export function subscribeInventory(cb: (items: InventoryItem[]) => void): Unsubscribe {
  return onSnapshot(collection(requireDb(), COLL), (snap) => {
    const items = snap.docs.map((d) => fromFirestore(d.id, d.data()));
    cb(items);
  });
}

export function subscribeInventoryItem(
  id: string,
  cb: (item: InventoryItem | null) => void,
): Unsubscribe {
  return onSnapshot(doc(requireDb(), COLL, id), (snap) => {
    cb(snap.exists() ? fromFirestore(snap.id, snap.data()) : null);
  });
}

export async function createVariant(input: {
  materialVariantId?: string;
  itemType: string;
  category: string;
  tagUid?: string;
  sensorId?: string;
  currentStock: number;
  reorderPoint: number;
  threshold: number;
  forecastedDemandNext7Days: number;
  model: "Holt-Winters" | "Exponential Smoothing";
}): Promise<string> {
  const id = input.materialVariantId ?? `INV-${Date.now().toString().slice(-6)}`;
  const status = getInventoryStatus({
    current_stock: input.currentStock,
    reorder_point: input.reorderPoint,
  } as InventoryItem);
  await setDoc(doc(requireDb(), COLL, id), {
    item_type: input.itemType,
    category: input.category,
    tag_uid: input.tagUid ?? null,
    sensor_id: input.sensorId ?? null,
    current_stock: input.currentStock,
    threshold: input.threshold,
    reorder_point: input.reorderPoint,
    forecasted_demand_next_7_days: input.forecastedDemandNext7Days,
    model: input.model,
    status,
    last_updated: Timestamp.now(),
    last_checkout_at: null,
  });
  return id;
}

export async function updateStock(id: string, newStock: number): Promise<void> {
  const status = getInventoryStatus({
    current_stock: newStock,
    reorder_point: 0, // overwritten below from the doc
  } as InventoryItem);
  // Read the current doc to recompute status with the real ROP.
  const snap = await (await import("firebase/firestore")).getDoc(
    doc(requireDb(), COLL, id),
  );
  const realStatus = snap.exists()
    ? getInventoryStatus({
        current_stock: newStock,
        reorder_point: (snap.data().reorder_point as number) ?? 0,
      } as InventoryItem)
    : status;
  await updateDoc(doc(requireDb(), COLL, id), {
    current_stock: newStock,
    status: realStatus,
    last_updated: Timestamp.now(),
  });
}

export async function updateReorderPoint(id: string, newRop: number): Promise<void> {
  await updateDoc(doc(requireDb(), COLL, id), {
    reorder_point: newRop,
    last_updated: Timestamp.now(),
  });
}

export async function deleteVariant(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), COLL, id));
}

// ---- internal helpers ----

function fromFirestore(id: string, data: Record<string, unknown>): InventoryItem {
  const item: InventoryItem = {
    id,
    name: (data.item_type as string) ?? id,
    material_variant_id: (data.material_variant_id as string) ?? id,
    item_type: (data.item_type as string) ?? "",
    category: (data.category as string) ?? "",
    tag_uid: (data.tag_uid as string) ?? undefined,
    sensor_id: (data.sensor_id as string) ?? undefined,
    current_stock: (data.current_stock as number) ?? 0,
    threshold: (data.threshold as number) ?? 0,
    reorder_point: (data.reorder_point as number) ?? 0,
    forecasted_demand_next_7_days:
      (data.forecasted_demand_next_7_days as number) ?? 0,
    model: (data.model as InventoryItem["model"]) ?? "Exponential Smoothing",
    status: (data.status as InventoryItem["status"]) ?? "In Stock",
    last_updated: fromTimestamp(data.last_updated) ?? new Date().toISOString(),
    lastCheckoutAt: fromTimestamp(data.last_checkout_at),
  };
  item.isStale = isStale(item);
  return item;
}

function fromTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

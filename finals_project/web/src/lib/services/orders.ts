/**
 * Firestore service — orders collection.
 *
 * Field shape (camelCase in the TS types ↔ snake_case in Firestore):
 *   customerName      ↔ customer_name
 *   customerEmail     ↔ customer_email
 *   customerPhone     ↔ customer_phone
 *   customerRegion    ↔ customer_region
 *   customerProvince  ↔ customer_province
 *   customerCity      ↔ customer_city
 *   customerBarangay  ↔ customer_barangay
 *   customerZip       ↔ customer_zip
 *   itemType          ↔ item_type
 *   layoutFile        ↔ layout_file
 *   targetDate        ↔ target_date (Timestamp)
 *   paymentAmount     ↔ payment_amount
 *   paymentStatus     ↔ payment_status
 *   paymentMethod     ↔ payment_method
 *   estimatedCompletion ↔ estimated_completion (Timestamp)
 *   basedOn           ↔ based_on (string[])
 *   createdAt         ↔ created_at (Timestamp)
 *   startedAt         ↔ started_at (Timestamp, optional)
 *   completedAt       ↔ completed_at (Timestamp, optional)
 *   cashierId         ↔ cashier_id
 *   productionNotes   ↔ production_notes
 *   actualMinutes     ↔ actual_minutes
 */
import {
 collection,
 onSnapshot,
 query,
 orderBy,
 doc,
 getDoc,
 addDoc,
 updateDoc,
 setDoc,
 Timestamp,
 type Unsubscribe,
} from "firebase/firestore";
import { requireDb } from "@/lib/firebase";
import type { Order } from "@/types";
import { getPriority, getETA } from "@/lib/derived";

const COLL = "orders";

/** Subscribe to all orders, sorted by createdAt desc. */
export function subscribeOrders(cb: (orders: Order[]) => void): Unsubscribe {
  const q = query(collection(requireDb(), COLL), orderBy("created_at", "desc"));
  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map((d) => fromFirestore(d.id, d.data()));
    cb(orders);
  });
}

/** Subscribe to one order by id. */
export function subscribeOrder(
  id: string,
  cb: (order: Order | null) => void,
): Unsubscribe {
  return onSnapshot(doc(requireDb(), COLL, id), (snap) => {
    cb(snap.exists() ? fromFirestore(snap.id, snap.data()) : null);
  });
}

/** Create a new order. Returns the generated orderId. */
export async function createOrder(input: Omit<Order, "id" | "order_id" | "priority" | "estimated_completion" | "based_on"> & {
  orderId?: string;
}): Promise<string> {
  const now = new Date();
  const priority = getPriority(
    { ...input, priority: "Upcoming", estimated_completion: new Date().toISOString().slice(0, 10), based_on: [] } as unknown as Order,
    now,
  );
  const eta = computeEta(input.target_date, priority, now);

  const orderId = input.orderId ?? `ORD-${Date.now().toString().slice(-6)}`;
  const doc_ = {
    customer_name: input.customer_name,
    customer_email: input.customer_email ?? null,
    customer_phone: input.customer_phone ?? null,
    customer_region: input.customer_region ?? null,
    customer_province: input.customer_province ?? null,
    customer_city: input.customer_city ?? null,
    customer_barangay: input.customer_barangay ?? null,
    customer_zip: input.customer_zip ?? null,
    item_type: input.item_type,
    quantity: input.quantity,
    layout_file: input.layout_file ?? "",
    target_date: toTimestamp(input.target_date),
    payment_amount: input.payment_amount,
    payment_status: input.payment_status ?? "Unpaid",
    payment_method: input.payment_method ?? null,
    status: input.status,
    priority,
    estimated_completion: toTimestamp(eta.iso),
    based_on: eta.basedOn,
    created_at: Timestamp.now(),
    cashier_id: input.cashier_id ?? null,
  };
  await setDoc(doc(requireDb(), COLL, orderId), doc_);
  return orderId;
}

/** Update the order's status (production flow). */
export async function updateOrderStatus(
  id: string,
  status: Order["status"],
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "In Production") patch.started_at = Timestamp.now();
  if (status === "Completed") patch.completed_at = Timestamp.now();
  await updateDoc(doc(requireDb(), COLL, id), patch);
}

/** Update the order's payment status. */
export async function updatePaymentStatus(
  id: string,
  paymentStatus: Order["payment_status"],
  paymentMethod?: Order["payment_method"],
): Promise<void> {
  const patch: Record<string, unknown> = { payment_status: paymentStatus };
  if (paymentMethod) patch.payment_method = paymentMethod;
  await updateDoc(doc(requireDb(), COLL, id), patch);
}

/** Mark an order as cancelled. We never delete orders — history is kept. */
export async function cancelOrder(id: string): Promise<void> {
  await updateDoc(doc(requireDb(), COLL, id), { status: "Cancelled" });
}

/** Mark an order as completed with optional production notes. */
export async function completeOrder(
  id: string,
  notes?: string,
  actualMinutes?: number,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: "Completed",
    completed_at: Timestamp.now(),
  };
  if (notes) patch.production_notes = notes;
  if (actualMinutes != null) patch.actual_minutes = actualMinutes;
  await updateDoc(doc(requireDb(), COLL, id), patch);
}

// ---- internal helpers ----

function fromFirestore(id: string, data: Record<string, unknown>): Order {
  return {
    id,
    order_id: (data.order_id as string) ?? id,
    customer_name: (data.customer_name as string) ?? "",
    customer_email: (data.customer_email as string) ?? undefined,
    customer_phone: (data.customer_phone as string) ?? undefined,
    customer_region: (data.customer_region as string) ?? undefined,
    customer_province: (data.customer_province as string) ?? undefined,
    customer_city: (data.customer_city as string) ?? undefined,
    customer_barangay: (data.customer_barangay as string) ?? undefined,
    customer_zip: (data.customer_zip as string) ?? undefined,
    item_type: (data.item_type as string) ?? "",
    quantity: (data.quantity as number) ?? 0,
    layout_file: (data.layout_file as string) ?? "",
    target_date: fromTimestamp(data.target_date) ?? new Date().toISOString().slice(0, 10),
    payment_amount: (data.payment_amount as number) ?? 0,
    payment_status: (data.payment_status as Order["payment_status"]) ?? "Unpaid",
    payment_method: (data.payment_method as Order["payment_method"]) ?? undefined,
    status: (data.status as Order["status"]) ?? "Pending",
    priority: (data.priority as Order["priority"]) ?? "Upcoming",
    estimated_completion:
      fromTimestamp(data.estimated_completion) ?? new Date().toISOString().slice(0, 10),
    based_on: (data.based_on as Order["based_on"]) ?? [],
    created_at: fromTimestamp(data.created_at),
  };
}

function toTimestamp(value: string | Date): Timestamp {
  const d = typeof value === "string" ? new Date(value) : value;
  return Timestamp.fromDate(d);
}

function fromTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in (value as Record<string, unknown>)) {
    return ((value as { toDate: () => Date }).toDate().toISOString().slice(0, 10));
  }
  return undefined;
}

function computeEta(
  targetDate: string,
  priority: Order["priority"],
  _now: Date,
): { iso: string; basedOn: string[] } {
  // +1 day for Overdue, +2 for Urgent, +3 for Upcoming — same rules the
  // mockData used, just expressed in days.
  const days = priority === "Overdue" ? 1 : priority === "Urgent" ? 2 : 3;
  const d = new Date(targetDate);
  d.setDate(d.getDate() + days);
  return {
    iso: d.toISOString().slice(0, 10),
    basedOn: ["backlog", "job_complexity", "capacity"],
  };
}

/**
 * Firestore service - orders collection.
 *
 * Field shape (camelCase in the TS types <-> snake_case in Firestore):
 *   customerName      <-> customer_name
 *   customerEmail     <-> customer_email
 *   customerPhone     <-> customer_phone
 *   customerRegion    <-> customer_region
 *   customerProvince  <-> customer_province
 *   customerCity      <-> customer_city
 *   customerBarangay  <-> customer_barangay
 *   customerZip       <-> customer_zip
 *   itemType          <-> item_type
 *   layoutFile        <-> layout_file
 *   targetDate        <-> target_date (Timestamp)
 *   paymentAmount     <-> payment_amount
 *   paymentStatus     <-> payment_status
 *   paymentMethod     <-> payment_method
 *   estimatedCompletion <-> estimated_completion (Timestamp)
 *   basedOn           <-> based_on (string[])
 *   createdAt         <-> created_at (Timestamp)
 *   startedAt         <-> started_at (Timestamp, optional)
 *   completedAt       <-> completed_at (Timestamp, optional)
 *   cashierId         <-> cashier_id
 *   productionNotes   <-> production_notes
 *   actualMinutes     <-> actual_minutes
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
  runTransaction,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { requireDb } from "@/lib/firebase";
import { logAudit } from "@/lib/services/audit";
import { markLocalActivity } from "@/lib/live-activity";
import type { Order } from "@/types";
import {
  completedUnitsLast7d,
  getLiveETA,
  getPriority,
  isActiveStatus,
} from "@/lib/derived";

const COLL = "orders";
/** Shared sequence counter for human-friendly order ids. */
const COUNTER_COLL = "counters";
const ORDER_COUNTER_DOC = "orders";

/** ORD-0001, ORD-0002, ... (4-digit pad; keeps growing past 9999). */
function formatOrderId(sequence: number): string {
  return `ORD-${String(sequence).padStart(4, "0")}`;
}

/** Firestore subscription failure handler (permission/offline). */
export type FeedErrorHandler = (e: unknown) => void;

function logFeedError(scope: string): FeedErrorHandler {
  return (e) => {
    console.error(`[${scope}] subscription failed:`, e);
  };
}

/**
 * Subscribe to all orders, sorted by createdAt desc.
 *
 * Priority is re-derived live from each order's target date on every
 * snapshot (Overdue < today, Urgent <= 2 days, else Upcoming), and the
 * ETA is recomputed from the live backlog (Title 1 objective 9), so
 * tags, tabs, counts, and dates never go stale as the clock advances -
 * the stored values are only create-time defaults.
 */
export function subscribeOrders(
  cb: (orders: Order[]) => void,
  onError: FeedErrorHandler = logFeedError("orders"),
): Unsubscribe {
  const q = query(collection(requireDb(), COLL), orderBy("created_at", "desc"));
  return onSnapshot(q, (snap) => {
    const now = new Date();
    const parsed = snap.docs.map((d) => fromFirestore(d.id, d.data()));
    const active = parsed.filter((o) => isActiveStatus(o.status));
    const rate = completedUnitsLast7d(parsed, now) / 7;
    cb(
      parsed.map((o) => {
        o.priority = getPriority(o, now);
        if (isActiveStatus(o.status)) {
          const eta = getLiveETA(o, active, rate, now);
          o.estimated_completion = eta.iso;
          o.based_on = eta.basedOn;
        }
        return o;
      }),
    );
  }, onError);
}

/**
 * Subscribe to one order by id (priority + ETA derived live against a
 * standalone context - rank 0, cold-start rate - since the full queue
 * isn't in scope here).
 */
export function subscribeOrder(
  id: string,
  cb: (order: Order | null) => void,
  onError: FeedErrorHandler = logFeedError("orders"),
): Unsubscribe {
  return onSnapshot(doc(requireDb(), COLL, id), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const now = new Date();
    const o = fromFirestore(snap.id, snap.data());
    o.priority = getPriority(o, now);
    if (isActiveStatus(o.status)) {
      const eta = getLiveETA(o, [o], 0, now);
      o.estimated_completion = eta.iso;
      o.based_on = eta.basedOn;
    }
    cb(o);
  }, onError);
}

/**
 * Create a new order. Returns the persisted order id.
 *
 * New orders get a sequential, human-friendly id (ORD-0001, ORD-0002,
 * ...) minted from the shared `counters/orders` sequence. The counter
 * read + increment and the order write share one transaction, so
 * concurrent cashiers can never mint the same number. Callers may still
 * pass an explicit `orderId` (legacy/import) to bypass the sequence.
 */
export async function createOrder(input: Omit<Order, "id" | "order_id" | "priority" | "estimated_completion" | "based_on"> & {
  orderId?: string;
}): Promise<string> {
  const now = new Date();
  const priority = getPriority(
    { ...input, priority: "Upcoming", estimated_completion: new Date().toISOString().slice(0, 10), based_on: [] } as unknown as Order,
    now,
  );
  const eta = computeEta(input.target_date, priority, now);

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
  const explicitId = input.orderId?.trim();
  let orderId: string;
  if (explicitId) {
    orderId = explicitId;
    await setDoc(doc(requireDb(), COLL, orderId), doc_);
  } else {
    const db = requireDb();
    orderId = await runTransaction(db, async (tx) => {
      const counterRef = doc(db, COUNTER_COLL, ORDER_COUNTER_DOC);
      const snap = await tx.get(counterRef);
      const last = snap.data()?.last;
      const next = (typeof last === "number" ? last : 0) + 1;
      const id = formatOrderId(next);
      tx.set(counterRef, { last: next, updated_at: Timestamp.now() });
      tx.set(doc(db, COLL, id), doc_);
      return id;
    });
  }

  markLocalActivity("order", orderId);
  logAudit({
   action: "order_created",
   module: "orders",
   record_id: orderId,
   record_label: `Order ${orderId} (${input.item_type} x ${input.quantity})`,
   old_value: null,
   new_value: `status=${input.status}, amount=${input.payment_amount}`,
  });
  return orderId;
}

/**
 * Update the order's status (production flow).
 *
 * Entering "In Production" means materials were pulled: the recipe is
 * auto-deducted afterwards (idempotent - re-entries deduct nothing).
 * Stock failures never block the status change; a missing BOM only
 * warns (log usage manually instead).
 */
export async function updateOrderStatus(
  id: string,
  status: Order["status"],
  byUid?: string | null,
): Promise<void> {
  const prevSnap = await getDoc(doc(requireDb(), COLL, id)).catch(() => null);
  const prevStatus = (prevSnap?.data()?.status as string | undefined) ?? null;
  const patch: Record<string, unknown> = { status };
  if (status === "In Production") patch.started_at = Timestamp.now();
  if (status === "Completed") patch.completed_at = Timestamp.now();
  await updateDoc(doc(requireDb(), COLL, id), patch);
  markLocalActivity("order", id);
  logAudit({
   action: "order_status_updated",
   module: "orders",
   record_id: id,
   record_label: `Order ${id}`,
   old_value: prevStatus,
   new_value: status,
  });
  if (status === "In Production") {
    try {
      const { autoDeductForOrder } = await import("@/lib/services/usage");
      await autoDeductForOrder(id, byUid ?? null);
    } catch (e) {
      // Status already moved; deduction retries on re-entry.
      console.warn(`[orders] auto-deduct failed for ${id}:`, e);
    }
  }
}

/** Update the order's payment status. */
export async function updatePaymentStatus(
  id: string,
  paymentStatus: Order["payment_status"],
  paymentMethod?: Order["payment_method"],
): Promise<void> {
  const prevSnap = await getDoc(doc(requireDb(), COLL, id)).catch(() => null);
  const prev = prevSnap?.data() as Record<string, unknown> | undefined;
  const patch: Record<string, unknown> = { payment_status: paymentStatus };
  if (paymentMethod) patch.payment_method = paymentMethod;
  await updateDoc(doc(requireDb(), COLL, id), patch);
  markLocalActivity("order", id);
  logAudit({
   action: "payment_updated",
   module: "payments",
   record_id: id,
   record_label: `Order ${id}`,
   old_value:
    paymentLabel(prev?.payment_status, prev?.payment_method) ?? null,
   new_value: paymentLabel(paymentStatus, paymentMethod ?? prev?.payment_method),
  });
}

/** Mark an order as cancelled. We never delete orders - history is kept. */
export async function cancelOrder(id: string): Promise<void> {
  const prevSnap = await getDoc(doc(requireDb(), COLL, id)).catch(() => null);
  const prevStatus = (prevSnap?.data()?.status as string | undefined) ?? null;
  await updateDoc(doc(requireDb(), COLL, id), { status: "Cancelled" });
  markLocalActivity("order", id);
  logAudit({
   action: "order_cancelled",
   module: "orders",
   record_id: id,
   record_label: `Order ${id}`,
   old_value: prevStatus,
   new_value: "Cancelled",
  });
}

function paymentLabel(status: unknown, method: unknown): string | null {
  if (status == null && method == null) return null;
  return `${String(status ?? "-")} via ${String(method ?? "-")}`;
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
    cashier_id: (data.cashier_id as string) ?? undefined,
    stock_deducted: (data.stock_deducted as boolean) ?? false,
    deducted_at: fromDateTime(data.deducted_at),
    status: (data.status as Order["status"]) ?? "Pending",
    priority: (data.priority as Order["priority"]) ?? "Upcoming",
    estimated_completion:
      fromTimestamp(data.estimated_completion) ?? new Date().toISOString().slice(0, 10),
    based_on: (data.based_on as Order["based_on"]) ?? [],
    created_at: fromDateTime(data.created_at),
    started_at: fromDateTime(data.started_at),
    completed_at: fromDateTime(data.completed_at),
  };
}

function toTimestamp(value: string | Date): Timestamp {
  const d = typeof value === "string" ? new Date(value) : value;
  return Timestamp.fromDate(d);
}

/**
 * DATE-ONLY conversion (YYYY-MM-DD) for planning fields: `target_date`
 * and `estimated_completion`. Those are calendar days, not instants.
 */
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

/**
 * Full ISO instant (with time-of-day) for datetime fields: `created_at`,
 * `started_at`, `completed_at`, `deducted_at`.
 *
 * The time matters: the notification centre renders "4 minutes ago",
 * the 7-day sparkline bucketing and staleness windows compare instants.
 * Date-only truncation here made a just-created order read "2 hours
 * ago" (midnight UTC vs now).
 */
function fromDateTime(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in (value as Record<string, unknown>)) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}

function computeEta(
  targetDate: string,
  priority: Order["priority"],
  _now: Date,
): { iso: string; basedOn: string[] } {
  // +1 day for Overdue, +2 for Urgent, +3 for Upcoming - rule-based
  // estimate from the order's priority band (see Title 1 objective 9).
  const days = priority === "Overdue" ? 1 : priority === "Urgent" ? 2 : 3;
  const d = new Date(targetDate);
  d.setDate(d.getDate() + days);
  return {
    iso: d.toISOString().slice(0, 10),
    basedOn: ["backlog", "job_complexity", "capacity"],
  };
}

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
 ArrowLeft,
 AlertTriangle,
 Clock,
 FileText,
 User,
 Package,
 CreditCard,
 Calendar,
 Check,
 Loader2,
} from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
 ContentCard,
 Button,
 Modal,
 StatusBadge,
 EmptyState,
 PriorityBadge,
 PaymentBadge,
 FeedErrorBanner,
 LayoutPreview,
 useToast,
} from "@/components/ui";
import { toPaymentStatus } from "@/components/ui/PaymentBadge";
import {
 subscribeOrder,
 subscribeOrders,
 updateOrderStatus,
 updateOrderMaterials,
 cancelOrder,
 cancelOrderWithReturn,
} from "@/lib/services/orders";
import { subscribeInventory } from "@/lib/services/inventory";
import { useFeedStatus } from "@/lib/useFeedStatus";
import { isActiveStatus } from "@/lib/derived";
import { Order, InventoryItem } from "@/types";

const STEPS = [
 "Pending",
 "In Production",
 "Ready for Pickup",
 "Completed",
] as const;

type Step = (typeof STEPS)[number];

const STEP_DATES: Record<Step, (o: Order) => string> = {
 Pending: (o) => o.created_at ?? o.target_date,
 "In Production": (o) => o.created_at ?? o.target_date,
 "Ready for Pickup": (o) => o.estimated_completion,
 Completed: (o) => o.estimated_completion,
};

export default function OrderDetailPage() {
 const params = useParams();
 const id = params.id as string;
 const toast = useToast();

 const [order, setOrder] = useState<Order | null | undefined>(undefined);
 const [queue, setQueue] = useState<Order[]>([]);
 const [inventory, setInventory] = useState<InventoryItem[]>([]);
 const [status, setStatus] = useState<Step | undefined>(undefined);
 const [saving, setSaving] = useState(false);
 const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

 // Edit materials (Pending only)
 const [editOpen, setEditOpen] = useState(false);
 const [editLines, setEditLines] = useState<
  Array<{ variant: string; qty: string }>
 >([]);
 const [editSaving, setEditSaving] = useState(false);
 const [editError, setEditError] = useState<string | null>(null);

 // Cancel (anytime until handover) with optional stock return
 const [cancelOpen, setCancelOpen] = useState(false);
 const [cancelLines, setCancelLines] = useState<
  Array<{ variant: string; qty: string }>
 >([]);
 const [cancelSaving, setCancelSaving] = useState(false);
 const [cancelError, setCancelError] = useState<string | null>(null);

 const canCancel =
  status === "Pending" ||
  status === "In Production" ||
  status === "Ready for Pickup";

  useEffect(() => {
   const unsub = subscribeOrder(id, (row) => {
    setOrder(row);
    if (row) setStatus(row.status as Step);
   }, onFeedError);
   return () => unsub();
  }, [id, feedNonce, onFeedError]);

 // Full-queue subscription so the ETA shown here is the SAME queue-aware
 // value the lists show. subscribeOrder derives ETA against a standalone
 // (rank-0, cold-start) context, which disagrees whenever backlog or
 // completion history exists.
 useEffect(() => {
  const unsubQueue = subscribeOrders(setQueue, onFeedError);
  return () => unsubQueue();
 }, [feedNonce, onFeedError]);

 // Live inventory for the materials section (stock per line + picker).
 useEffect(() => {
  const unsubInv = subscribeInventory(setInventory, onFeedError);
  return () => unsubInv();
 }, [feedNonce, onFeedError]);

  // Single undefined guard (a split `=== undefined && !feedError` /
  // `=== undefined && feedError` pair does not narrow for TS) - the error
  // branch renders inside when the feed failed.
  if (order === undefined) {
   if (feedError) {
    return (
     <AdminLayout title="Couldn't load order" subtitle={`Order ${id}`}>
      <FeedErrorBanner
       message={feedError}
       onRetry={retryFeed}
      />
      <ContentCard className="text-center py-16">
       <EmptyState
        icon={<AlertTriangle className="w-8 h-8" />}
        title="Couldn't load this order"
        description="Check your connection and permissions, then retry."
        action={
         <Link href="/orders">
          <Button variant="secondary">
           <ArrowLeft className="w-4 h-4 mr-2" />
           Back to Orders
          </Button>
         </Link>
        }
       />
      </ContentCard>
     </AdminLayout>
    );
   }
   return (
    <AdminLayout title="Loading..." subtitle={`Order ${id}`}>
     <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-printflow-primary animate-spin" />
     </div>
    </AdminLayout>
   );
  }

  if (order === null) {
  return (
   <AdminLayout title="Order Not Found" subtitle={`No order ${id}`}>
    <ContentCard className="text-center py-16">
     <EmptyState
      icon={<AlertTriangle className="w-8 h-8" />}
      title="Order Not Found"
      description={`No order found with ID: ${id}`}
      action={
       <Link href="/orders">
        <Button variant="primary">
         <ArrowLeft className="w-4 h-4 mr-2" />
         Back to Orders
        </Button>
       </Link>
      }
     />
    </ContentCard>
   </AdminLayout>
  );
 }

  // Prefer the queue-computed ETA (identical to list views) over the
  // standalone estimate whenever this order is active in the queue. The
  // merged `shown` order feeds EVERYTHING below (ETA card + timeline), so
  // no two dates on this page can disagree.
  const queued =
   queue.find((o) => o.order_id === order?.order_id) ??
   queue.find((o) => o.id === id);
  const shown: Order =
   queued && isActiveStatus(queued.status)
    ? {
       ...order,
       estimated_completion: queued.estimated_completion,
       based_on: queued.based_on,
      }
    : order;
  const shownEta = shown.estimated_completion;
  const shownBasedOn = shown.based_on;

  const currentIdx = status ? STEPS.indexOf(status) : -1;

  const advance = async () => {
   if (!status) return;
   const idx = STEPS.indexOf(status);
   if (idx < 0 || idx >= STEPS.length - 1) return;
   const next = STEPS[idx + 1];
   setStatus(next);
   setSaving(true);
   try {
    await updateOrderStatus(order.order_id, next);
    toast.success(`Order ${order.order_id} moved to ${next}`);
   } catch (e) {
    // Roll back the optimistic stepper so the UI matches the server.
    setStatus(order.status as Step);
    toast.error(
     e instanceof Error && e.message
      ? `Failed to update status: ${e.message}`
      : "Failed to update status - please try again.",
    );
   } finally {
    setSaving(false);
   }
  };

  const openEdit = () => {
   setEditLines(
    (order.materials ?? []).map((m) => ({
     variant: m.material_variant_id,
     qty: String(m.qty),
    })),
   );
   setEditError(null);
   setEditOpen(true);
  };

  const handleEditSave = async () => {
   // Merge duplicate variants by summing.
   const merged = new Map<string, number>();
   for (const line of editLines) {
    const vid = line.variant.trim();
    const qty = Number(line.qty);
    if (!vid || !Number.isInteger(qty) || qty <= 0) {
     setEditError("Each line needs a variant and a positive whole quantity.");
     return;
    }
    merged.set(vid, (merged.get(vid) ?? 0) + qty);
   }
   setEditSaving(true);
   setEditError(null);
   try {
    await updateOrderMaterials(
     order.order_id,
     [...merged.entries()].map(([material_variant_id, qty]) => ({
      material_variant_id,
      qty,
     })),
    );
    toast.success(`Order ${order.order_id} materials updated`);
    setEditOpen(false);
   } catch (e) {
    setEditError(
     e instanceof Error ? e.message : "Could not save the changes.",
    );
   } finally {
    setEditSaving(false);
   }
  };

  const openCancel = async () => {
   setCancelError(null);
   if (!order.stock_deducted) {
    setCancelLines([]);
    setCancelOpen(true);
    return;
   }
   try {
    const { getReturnableLines } = await import("@/lib/services/usage");
    const lines = await getReturnableLines(order.order_id);
    setCancelLines(
     lines.length > 0
      ? lines.map((l) => ({ variant: l.variant, qty: String(l.qty) }))
      : (order.materials ?? []).map((m) => ({
         variant: m.material_variant_id,
         qty: String(m.qty),
        })),
    );
   } catch {
    setCancelLines(
     (order.materials ?? []).map((m) => ({
      variant: m.material_variant_id,
      qty: String(m.qty),
     })),
    );
   }
   setCancelOpen(true);
  };

  const handleCancelConfirm = async () => {
   // Plain path when nothing was deducted.
   if (cancelLines.length === 0) {
    setCancelSaving(true);
    setCancelError(null);
    try {
     await cancelOrder(order.order_id);
     toast.success(`Order ${order.order_id} cancelled`);
     setCancelOpen(false);
    } catch (e) {
     setCancelError(e instanceof Error ? e.message : "Could not cancel.");
    } finally {
     setCancelSaving(false);
    }
    return;
   }
   // Return path: editable quantities (0 = keep deducted).
   const returns: Record<string, number> = {};
   for (const line of cancelLines) {
    const vid = line.variant.trim();
    const qty = Number(line.qty);
    if (!vid || !Number.isInteger(qty) || qty < 0) {
     setCancelError("Quantities must be whole numbers (0 or more).");
     return;
    }
    if (qty > 0) returns[vid] = (returns[vid] ?? 0) + qty;
   }
   setCancelSaving(true);
   setCancelError(null);
   try {
    await cancelOrderWithReturn(order.order_id, returns);
    toast.success(`Order ${order.order_id} cancelled`);
    setCancelOpen(false);
   } catch (e) {
    setCancelError(e instanceof Error ? e.message : "Could not cancel.");
   } finally {
    setCancelSaving(false);
   }
  };

  return (
  <AdminLayout
   title={`${order.order_id}`}
   subtitle={`${order.customer_name} - ${order.item_type}`}
  >
   <Link
    href="/orders"
    className="inline-flex items-center gap-2 text-sm text-printflow-primary hover:underline mb-6"
   >
    <ArrowLeft className="w-4 h-4" />
    Back to Orders
   </Link>

   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <ContentCard title="Order Details">
     <div className="space-y-3 text-sm">
      <div className="flex gap-2">
       <FileText className="w-4 h-4 text-printflow-primary mt-0.5" />
       <div>
        <p className="text-xs text-printflow-on-surface-variant">Order ID</p>
        <p className="type-mono font-semibold">{order.order_id}</p>
       </div>
      </div>
      <div className="flex gap-2">
       <User className="w-4 h-4 text-printflow-primary mt-0.5" />
       <div>
        <p className="text-xs text-printflow-on-surface-variant">Customer</p>
        <p>{order.customer_name}</p>
       </div>
      </div>
      <div className="flex gap-2">
       <Package className="w-4 h-4 text-printflow-primary mt-0.5" />
       <div>
        <p className="text-xs text-printflow-on-surface-variant">Item Type</p>
        <p>{order.item_type}</p>
       </div>
      </div>
      <div className="flex gap-2">
       <Package className="w-4 h-4 text-printflow-primary mt-0.5" />
       <div>
        <p className="text-xs text-printflow-on-surface-variant">Quantity</p>
        <p>{order.quantity}</p>
       </div>
      </div>
       <div className="flex gap-2">
        <FileText className="w-4 h-4 text-printflow-primary mt-0.5" />
        <div className="min-w-0">
         <p className="text-xs text-printflow-on-surface-variant">Layout File</p>
         <div className="mt-1">
          <LayoutPreview value={order.layout_file} size={96} />
         </div>
        </div>
       </div>
     </div>
    </ContentCard>

    <ContentCard title="Schedule & Status">
     <div className="space-y-3 text-sm">
      <div>
       <p className="text-xs text-printflow-on-surface-variant">Target Date</p>
       <p className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-4 h-4" />
        {order.target_date}
        <PriorityBadge
         priority={
          order.priority.toLowerCase() as "overdue" | "urgent" | "upcoming"
         }
        />
       </p>
      </div>
      <div>
       <p className="text-xs text-printflow-on-surface-variant">Status</p>
       <div className="mt-1">
        <StatusBadge
         status={status?.toLowerCase().replace(/\s+/g, "-") as any}
         customLabel={status}
        />
       </div>
      </div>
      <div
       className="p-3 bg-printflow-primary-fixed/10 rounded-lg border border-printflow-primary-fixed/30"
       title="ETA = backlog + job_complexity + capacity"
      >
       <p className="text-xs text-printflow-on-surface-variant">
        Estimated Completion
       </p>
        <p className="text-lg font-bold text-printflow-primary">
         {shownEta}
        </p>
        {shownBasedOn && shownBasedOn.length > 0 && (
         <p className="text-[10px] text-printflow-on-surface-variant mt-1">
          Based on: {shownBasedOn.join(", ")}
         </p>
        )}
      </div>
      <div>
       <p className="text-xs text-printflow-on-surface-variant">Payment</p>
       <p className="flex items-center gap-2 flex-wrap">
        <CreditCard className="w-4 h-4" />₱{order.payment_amount}
        <PaymentBadge
         status={toPaymentStatus(order.payment_status)}
        />
       </p>
      </div>
     </div>
    </ContentCard>

    <ContentCard title="Activity">
     <div className="mt-2">
      <p className="text-xs text-printflow-on-surface-variant">Created</p>
      <p className="text-sm flex items-center gap-2">
       <Clock className="w-4 h-4" />
       {(order.created_at ?? order.target_date).slice(0, 10)}
      </p>
     </div>
     <div className="mt-5 pt-5 border-t border-printflow-outline-variant/40 space-y-2">
      <p className="type-label uppercase tracking-wider text-printflow-on-surface-variant">
       Update status
      </p>
      <Button
       variant="primary"
       onClick={advance}
       disabled={!status || currentIdx >= STEPS.length - 1 || saving}
       className="w-full"
      >
       {saving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
       ) : (
        <Check className="w-4 h-4" />
       )}
       {currentIdx >= STEPS.length - 1
        ? "Order complete"
        : `Mark complete: move to ${STEPS[currentIdx + 1]}`}
      </Button>
      {canCancel && (
       <Button
        variant="secondary"
        onClick={() => void openCancel()}
        disabled={saving}
        className="w-full"
       >
        Cancel order
       </Button>
      )}
     </div>
    </ContentCard>
   </div>

    <ContentCard
     title="Materials needed"
     subtitle={
      order.stock_deducted
       ? "Deducted at production"
       : order.status === "Pending"
        ? "Pinned at creation - editable while Pending"
        : "Planned at creation"
     }
    >
     {!order.materials || order.materials.length === 0 ? (
      <div className="flex items-center justify-between gap-3">
       <p className="text-sm text-printflow-on-surface-variant">
        No pinned materials - uses the live BOM recipe at production.
       </p>
       {order.status === "Pending" && (
        <Button variant="secondary" onClick={openEdit}>
         Edit
        </Button>
       )}
      </div>
     ) : (
      <div className="space-y-2">
       {order.materials.map((m, idx) => {
        const item = inventory.find(
         (i) => i.material_variant_id === m.material_variant_id,
        );
        const stock = item?.current_stock;
        const short =
         stock !== undefined && stock < m.qty;
        return (
         <div
          key={`${m.material_variant_id}-${idx}`}
          className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
           short
            ? "border-printflow-error/40 bg-printflow-error/5"
            : "border-printflow-outline-variant/40"
          }`}
         >
          <div className="min-w-0">
           <p className="font-mono text-xs font-semibold truncate">
            {m.material_variant_id}
           </p>
           <p
            className={`text-xs truncate ${
             item
              ? "text-printflow-on-surface-variant"
              : "text-printflow-error font-medium"
            }`}
           >
            {item ? item.item_type : "Not in inventory"}
           </p>
          </div>
          <div className="text-right shrink-0">
           <p className="text-sm font-bold">x{m.qty}</p>
           {stock !== undefined && (
            <p
             className={`text-xs ${
              short
               ? "text-printflow-error font-semibold"
               : "text-printflow-on-surface-variant"
             }`}
            >
             stock {stock}
            </p>
           )}
          </div>
         </div>
        );
       })}
       {order.status === "Pending" && (
        <Button variant="secondary" onClick={openEdit} className="w-full">
         Edit materials
        </Button>
       )}
      </div>
     )}
    </ContentCard>

    <ContentCard title="Status Timeline" subtitle="Workflow IV - Order lifecycle">
    <ol className="space-y-2" role="list">
     {STEPS.map((s, i) => {
      const done = i <= currentIdx;
      const isCurrent = i === currentIdx;
      return (
       <li
        key={s}
        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
         isCurrent
          ? "border-printflow-primary/40 bg-printflow-primary-fixed/15"
          : done
          ? "border-printflow-outline-variant/30 bg-printflow-surface-container/40"
          : "border-printflow-outline-variant/30 bg-transparent"
        }`}
       >
        <div
         className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold step-pulse ${
          done
           ? "bg-printflow-primary text-printflow-on-primary"
           : "bg-printflow-surface-container-high text-printflow-on-surface-variant"
         }`}
         aria-current={isCurrent ? "step" : undefined}
        >
         {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
        </div>
        <div className="flex-1 min-w-0">
         <p
          className={`text-sm font-medium ${
           isCurrent
            ? "text-printflow-on-surface"
            : done
            ? "text-printflow-on-surface"
            : "text-printflow-on-surface-variant"
          }`}
         >
          {s}
         </p>
          {done && (
           <p className="text-xs text-printflow-on-surface-variant">
            {STEP_DATES[s](shown).slice(0, 10)}
           </p>
          )}
        </div>
        {isCurrent && (
         <span className="text-[10px] px-2 py-0.5 rounded-full bg-printflow-primary text-printflow-on-primary font-semibold">
          Current
         </span>
        )}
       </li>
       );
      })}
     </ol>
    </ContentCard>

    <Modal
     isOpen={editOpen}
     onClose={() => {
      if (!editSaving) setEditOpen(false);
     }}
     title={`Edit materials - ${order.order_id}`}
     description="Pinned at creation, editable while Pending."
     size="md"
     footer={
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
       <Button
        variant="secondary"
        onClick={() => setEditOpen(false)}
        disabled={editSaving}
        className="flex-1 sm:flex-none"
       >
        Cancel
       </Button>
       <Button
        variant="primary"
        onClick={() => void handleEditSave()}
        disabled={editSaving}
        className="flex-1 sm:flex-none"
       >
        {editSaving ? "Saving..." : "Save changes"}
       </Button>
      </div>
     }
    >
     <div className="space-y-3">
      {editError && (
       <div
        role="alert"
        className="px-4 py-3 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-sm"
       >
        {editError}
       </div>
      )}
      {editLines.map((line, idx) => (
       <div key={idx} className="flex items-center gap-2">
        <select
         value={line.variant}
         onChange={(e) =>
          setEditLines((rows) =>
           rows.map((r, i) =>
            i === idx ? { ...r, variant: e.target.value } : r,
           ),
          )
         }
         className="flex-[3] min-w-0 px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
        >
         <option value="">Pick a variant…</option>
         {inventory.map((i) => (
          <option key={i.material_variant_id} value={i.material_variant_id}>
           {i.material_variant_id} - {i.item_type}
          </option>
         ))}
        </select>
        <input
         type="number"
         min={1}
         step={1}
         value={line.qty}
         onChange={(e) =>
          setEditLines((rows) =>
           rows.map((r, i) => (i === idx ? { ...r, qty: e.target.value } : r)),
          )
         }
         className="flex-1 min-w-0 px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
        />
        <button
         type="button"
         aria-label="Remove line"
         onClick={() =>
          setEditLines((rows) => rows.filter((_, i) => i !== idx))
         }
         className="shrink-0 p-2 rounded-lg text-printflow-error hover:bg-printflow-error/10"
        >
         ✕
        </button>
       </div>
      ))}
      <Button
       variant="secondary"
       onClick={() =>
        setEditLines((rows) => [...rows, { variant: "", qty: "1" }])
       }
       className="w-full"
      >
       + Add line
      </Button>
     </div>
    </Modal>

    <Modal
     isOpen={cancelOpen}
     onClose={() => {
      if (!cancelSaving) setCancelOpen(false);
     }}
     title={`Cancel ${order.order_id}?`}
     description={
      cancelLines.length === 0
       ? "The order will be cancelled. Nothing was deducted, so no stock changes."
       : "Return unused materials to stock (0 keeps them deducted)."
     }
     size="md"
     footer={
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
       <Button
        variant="secondary"
        onClick={() => setCancelOpen(false)}
        disabled={cancelSaving}
        className="flex-1 sm:flex-none"
       >
        Keep
       </Button>
       <Button
        variant="primary"
        onClick={() => void handleCancelConfirm()}
        disabled={cancelSaving}
        className="flex-1 sm:flex-none"
       >
        {cancelSaving ? "Cancelling..." : "Cancel order"}
       </Button>
      </div>
     }
    >
     <div className="space-y-3">
      {cancelError && (
       <div
        role="alert"
        className="px-4 py-3 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-sm"
       >
        {cancelError}
       </div>
      )}
      {cancelLines.map((line, idx) => (
       <div key={idx} className="flex items-center gap-2">
        <p className="flex-[3] min-w-0 font-mono text-xs font-semibold truncate">
         {line.variant}
        </p>
        <input
         type="number"
         min={0}
         step={1}
         value={line.qty}
         onChange={(e) =>
          setCancelLines((rows) =>
           rows.map((r, i) =>
            i === idx ? { ...r, qty: e.target.value } : r,
           ),
          )
         }
         className="flex-1 min-w-0 px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
        />
       </div>
      ))}
     </div>
    </Modal>
   </AdminLayout>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
 ArrowLeft,
 AlertTriangle,
 Package,
 Clock,
 ShoppingCart,
 Inbox,
 Loader2,
} from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
  ContentCard,
  Button,
  Modal,
  StatusBadge,
  EmptyState,
  FeedErrorBanner,
  useToast,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { subscribeInventoryItem } from "@/lib/services/inventory";
import { subscribeRfidEventsForVariant } from "@/lib/services/rfid";
import { useFeedStatus } from "@/lib/useFeedStatus";
import {
  fetchOrderHeader,
  logStockIn,
  logUsage,
} from "@/lib/services/usage";
import type { InventoryItem, RfidCheckoutEvent } from "@/types";

const USAGE_REASONS = [
  "production-use",
  "wastage",
  "sample",
  "correction",
  "others",
] as const;

export default function VariantDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { user } = useAuth();

  const [item, setItem] = useState<InventoryItem | null | undefined>(undefined);
  const [history, setHistory] = useState<RfidCheckoutEvent[]>([]);
  const [sheet, setSheet] = useState<null | "in" | "out">(null);
  const [qty, setQty] = useState("10");
  const [reason, setReason] = useState<string>(USAGE_REASONS[0]);
  const [note, setNote] = useState("");
  const [orderId, setOrderId] = useState("");
  const [confirmAnyway, setConfirmAnyway] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  useEffect(() => {
   const unsubItem = subscribeInventoryItem(id, (row) => setItem(row), onFeedError);
   const unsubHist = subscribeRfidEventsForVariant(id, setHistory, 50, onFeedError);
   return () => {
    unsubItem();
    unsubHist();
   };
  }, [id, feedNonce, onFeedError]);

  // Single undefined guard (a split `=== undefined && !feedError` /
  // `=== undefined && feedError` pair does not narrow for TS) - the error
  // branch renders inside when the feed failed.
  if (item === undefined) {
   if (feedError) {
    return (
     <AdminLayout title="Couldn't load variant" subtitle={`Variant ${id}`}>
      <FeedErrorBanner
       message={feedError}
       onRetry={retryFeed}
      />
      <ContentCard className="text-center py-16">
       <EmptyState
        icon={<AlertTriangle className="w-8 h-8" />}
        title="Couldn't load this variant"
        description="Check your connection and permissions, then retry."
        action={
         <Link href="/inventory">
          <Button variant="secondary">
           <ArrowLeft className="w-4 h-4 mr-2" />
           Back to Inventory
          </Button>
         </Link>
        }
       />
      </ContentCard>
     </AdminLayout>
    );
   }
   return (
    <AdminLayout title="Loading..." subtitle={`Variant ${id}`}>
     <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-printflow-primary animate-spin" />
     </div>
    </AdminLayout>
   );
  }

  if (item === null) {
   return (
    <AdminLayout title="Variant Not Found" subtitle={`No variant ${id}`}>
     <ContentCard className="text-center py-16">
      <EmptyState
       icon={<AlertTriangle className="w-8 h-8" />}
       title="Not Found"
       description={`No material_variant_id ${id}`}
       action={
        <Link href="/inventory">
         <Button variant="primary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
         </Button>
        </Link>
       }
      />
     </ContentCard>
    </AdminLayout>
   );
  }

  // -- Movement modal (main branch only; `item` is non-null here) --
  const movementModal = (
    <Modal
     isOpen={sheet !== null}
     onClose={() => {
      if (!saving) setSheet(null);
     }}
     title={sheet === "in" ? "Stock In" : "Log Usage"}
     description={
      sheet === "in"
       ? `Receive delivery for ${item.material_variant_id} - writes an audited stock-in entry.`
       : `Record stock taken for ${item.material_variant_id} - wastage, sample, or extra production use.`
     }
     size="md"
     footer={
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
       <Button
        variant="secondary"
        onClick={() => setSheet(null)}
        disabled={saving}
        className="flex-1 sm:flex-none"
       >
        Cancel
       </Button>
       <Button
        variant="primary"
        onClick={() => void handleMovementSubmit()}
        disabled={saving}
        className="flex-1 sm:flex-none"
       >
        {saving
         ? "Saving..."
         : confirmAnyway
          ? "Confirm anyway"
          : sheet === "in"
           ? "Confirm stock-in"
           : "Confirm usage"}
       </Button>
      </div>
     }
    >
     <div className="space-y-4">
      {formError && (
       <div
        role="alert"
        className="px-4 py-3 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-sm"
       >
        {formError}
       </div>
      )}
      <div>
       <label className="block text-xs text-printflow-on-surface-variant mb-1">
        {sheet === "in" ? "Quantity received" : "Quantity used"}
       </label>
       <input
        type="number"
        min={1}
        step={1}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary"
       />
      </div>
      {sheet === "out" ? (
       <>
        <div>
         <label className="block text-xs text-printflow-on-surface-variant mb-1">
          Reason
         </label>
         <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary appearance-none"
         >
          {USAGE_REASONS.map((r) => (
           <option key={r} value={r}>
            {r}
           </option>
          ))}
         </select>
        </div>
        <div>
         <label className="block text-xs text-printflow-on-surface-variant mb-1">
          Link order ID (optional)
         </label>
         <input
          type="text"
          value={orderId}
          onChange={(e) => {
           setOrderId(e.target.value);
           setConfirmAnyway(false);
          }}
          placeholder="e.g. ORD-200101"
          className="w-full px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary"
         />
         <p className="text-xs text-printflow-on-surface-variant mt-1">
          Warns when the linked order was already auto-deducted.
         </p>
        </div>
       </>
      ) : (
       <div>
        <label className="block text-xs text-printflow-on-surface-variant mb-1">
         Note (optional)
        </label>
        <input
         type="text"
         value={note}
         onChange={(e) => setNote(e.target.value)}
         placeholder="e.g. Supplier delivery, PO-123"
         className="w-full px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary"
        />
       </div>
       )}
      </div>
     </Modal>
  );

  const createReorder = () => {
   toast.success(
    `Reorder queued for ${item.item_type} (${item.reorder_point * 2} units)`,
   );
  };

  const openSheet = (kind: "in" | "out") => {
   setSheet(kind);
   setQty(kind === "in" ? "10" : "1");
   setReason(USAGE_REASONS[0]);
   setNote("");
   setOrderId("");
   setConfirmAnyway(false);
   setFormError(null);
  };

  const handleMovementSubmit = async () => {
   if (!item || sheet === null) return;
   const n = Number(qty);
   if (!Number.isInteger(n) || n <= 0) {
    setFormError("Enter a positive whole number.");
    return;
   }
   const link = orderId.trim() === "" ? null : orderId.trim();
   // Double-count guard: an already-deducted linked order needs an
   // explicit second confirmation.
   if (sheet === "out" && link && !confirmAnyway) {
    const header = await fetchOrderHeader(link).catch(() => null);
    if (header === null) {
     setFormError(`Order not found: ${link}`);
     return;
    }
    if (header.stock_deducted) {
     setConfirmAnyway(true);
     setFormError(
      `Order ${link} already auto-deducted its recipe. Review, then confirm again to log ${n} more unit(s).`,
     );
     return;
    }
   }
   setSaving(true);
   setFormError(null);
   try {
    if (sheet === "in") {
     await logStockIn({
      materialVariantId: item.material_variant_id,
      qty: n,
      note: note.trim() === "" ? null : note.trim(),
      byUid: user?.uid ?? user?.id ?? null,
     });
     toast.success(`Stock in: +${n} ${item.material_variant_id}`);
    } else {
     const res = await logUsage({
      materialVariantId: item.material_variant_id,
      qty: n,
      reason,
      orderId: link,
      byUid: user?.uid ?? user?.id ?? null,
     });
     toast.success(
      res.shortfall
       ? `Usage logged (-${n}), but stock hit zero - flagged shortfall.`
       : `Usage logged: -${n} ${item.material_variant_id} (${reason})`,
     );
    }
    setSheet(null);
   } catch (e: unknown) {
    setFormError(e instanceof Error ? e.message : "Failed to save movement.");
   } finally {
    setSaving(false);
   }
  };

  return (
  <AdminLayout title={item.material_variant_id} subtitle={item.item_type}>
   <Link
    href="/inventory"
    className="inline-flex items-center gap-2 text-sm text-printflow-primary hover:underline mb-6"
   >
    <ArrowLeft className="w-4 h-4" />
    Back to Inventory
   </Link>

   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <ContentCard title="Material Details">
     <div className="space-y-3 text-sm">
      <div className="flex gap-2">
       <Package className="w-4 h-4 text-printflow-primary mt-0.5" />
       <div>
        <p className="text-xs text-printflow-on-surface-variant">Variant</p>
        <p className="type-mono font-bold flex items-center gap-2">
         {item.material_variant_id}
         {item.isStale && (
          <span
           className="text-[10px] px-1.5 py-0.5 rounded bg-printflow-warning-container text-printflow-warning"
           title="No RFID sync in the last 12 hours"
          >
           Delayed
          </span>
         )}
        </p>
       </div>
      </div>
      <div>
       <p className="text-xs text-printflow-on-surface-variant">Type</p>
       <p>
        {item.item_type} <span className="text-printflow-on-surface-variant">- {item.category}</span>
       </p>
      </div>
      <div>
       <p className="text-xs text-printflow-on-surface-variant">Tag</p>
       <p className="type-mono">{item.tag_uid ?? "-"}</p>
      </div>
      <div>
       <StatusBadge
        status={item.status.toLowerCase().replace(/\s+/g, "-") as any}
        customLabel={item.status}
       />
      </div>
     </div>
    </ContentCard>

    <ContentCard title="Stock">
     <div className="grid grid-cols-2 gap-3">
       <div className="p-3 bg-printflow-surface-container rounded-lg">
        <p className="text-xs text-printflow-on-surface-variant">
         Current Stock
        </p>
        <p className="text-xl font-bold mt-1">
         {item.current_stock}
        </p>
       </div>
      <div className="p-3 bg-printflow-surface-container rounded-lg">
       <p className="text-xs text-printflow-on-surface-variant">
        Threshold (ROP)
       </p>
       <p className="text-xl font-bold text-printflow-primary mt-1">
        {item.reorder_point}
       </p>
      </div>
      <div className="p-3 bg-printflow-surface-container rounded-lg">
       <p className="text-xs text-printflow-on-surface-variant">
        7-day Forecast
       </p>
       <p className="text-xl font-bold mt-1">
        {item.forecasted_demand_next_7_days}
       </p>
      </div>
      <div className="p-3 bg-printflow-surface-container rounded-lg">
       <p className="text-xs text-printflow-on-surface-variant">
        Last Updated
       </p>
       <p className="text-sm flex items-center gap-1 mt-1">
        <Clock className="w-4 h-4" />
        {item.last_updated}
       </p>
      </div>
     </div>
    </ContentCard>

     <ContentCard title="Actions">
      <div className="space-y-2">
       <Button
        variant="primary"
        className="w-full"
        onClick={createReorder}
       >
        <ShoppingCart className="w-4 h-4" />
        Create Reorder
       </Button>
       <Button
        variant="secondary"
        className="w-full"
        onClick={() => openSheet("in")}
       >
        <Package className="w-4 h-4" />
        Stock In
       </Button>
       <Button
        variant="secondary"
        className="w-full"
        onClick={() => openSheet("out")}
       >
        <Clock className="w-4 h-4" />
        Log Usage
       </Button>
       {item.isStale && (
       <Button
        variant="secondary"
        className="w-full"
        onClick={() =>
          toast.info(`Delayed sync alert acknowledged for ${item.material_variant_id}`)
        }
       >
        Acknowledge Alert
       </Button>
      )}
     </div>
    </ContentCard>
   </div>

   <ContentCard title="RFID Checkout History" subtitle="ESP32 station events">
    {history.length === 0 ? (
     <EmptyState
      icon={<Inbox className="w-6 h-6" />}
      title="No checkout events yet"
      description="Waiting for the ESP32 station to log the next checkout."
     />
    ) : (
     <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm">
       <thead>
        <tr>
         <th className="text-left p-2.5 bg-printflow-surface-container text-printflow-on-surface-variant text-xs uppercase tracking-wider">
          Time
         </th>
         <th className="text-left p-2.5 bg-printflow-surface-container text-printflow-on-surface-variant text-xs uppercase tracking-wider">
          Tag
         </th>
         <th className="text-left p-2.5 bg-printflow-surface-container text-printflow-on-surface-variant text-xs uppercase tracking-wider">
          Sensor
         </th>
         <th className="text-left p-2.5 bg-printflow-surface-container text-printflow-on-surface-variant text-xs uppercase tracking-wider">
          Change
         </th>
        </tr>
       </thead>
       <tbody>
        {history.map((h) => (
         <tr key={h.id} className="border-b border-printflow-outline-variant/30">
          <td className="p-2.5">{h.timestamp}</td>
          <td className="p-2.5 type-mono">{h.tag_uid ?? "-"}</td>
          <td className="p-2.5">{h.sensor_id ?? "-"}</td>
          <td className="p-2.5 text-printflow-error font-semibold">-1</td>
         </tr>
         ))}
        </tbody>
       </table>
      </div>
     )}
    </ContentCard>

    {movementModal}
   </AdminLayout>
  );
}

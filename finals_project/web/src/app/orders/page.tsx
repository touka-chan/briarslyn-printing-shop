"use client";

import { useEffect, useState } from "react";
import { Eye, Download, ShoppingCart, AlertTriangle, MapPin, ShoppingBag } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
  ContentCard,
  FilterToolbar,
  DataTable,
  StatusBadge,
  Button,
  Modal,
  PriorityBadge,
  PaymentBadge,
  EmptyState,
  FeedErrorBanner,
  LayoutPreview,
  useToast,
} from "@/components/ui";
import { toPaymentStatus } from "@/components/ui/PaymentBadge";
import { subscribeOrders } from "@/lib/services/orders";
import { subscribeInventory } from "@/lib/services/inventory";
import { csvRow, downloadCsv } from "@/lib/csv";
import { useFeedStatus } from "@/lib/useFeedStatus";
import { Order, InventoryItem } from "@/types";

function exportToCSV(rows: Order[]) {
 const headers = [
  "order_id",
  "customer_name",
  "customer_phone",
  "customer_email",
  "customer_region",
  "customer_province",
  "customer_city",
  "customer_barangay",
  "customer_zip",
  "item_type",
  "quantity",
  "target_date",
  "priority",
  "status",
  "estimated_completion",
  "based_on",
  "payment_amount",
  "payment_status",
 ];
  const lines = [
   headers.join(","),
   ...rows.map((r) =>
    csvRow([
     r.order_id,
     r.customer_name,
     r.customer_phone ?? "",
     r.customer_email ?? "",
     r.customer_region ?? "",
     r.customer_province ?? "",
     r.customer_city ?? "",
     r.customer_barangay ?? "",
     r.customer_zip ?? "",
     r.item_type,
     r.quantity,
     r.target_date,
     r.priority,
     r.status,
     r.estimated_completion,
     r.based_on ? r.based_on.join("|") : "",
     r.payment_amount,
     r.payment_status ?? "Unpaid",
    ]),
   ),
  ];
  downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, lines);
}

export default function OrdersPage() {
 const [orders, setOrders] = useState<Order[]>([]);
 const [inventory, setInventory] = useState<InventoryItem[]>([]);
 const [activePriority, setActivePriority] = useState("All");
 const [searchValue, setSearchValue] = useState("");
 const [selected, setSelected] = useState<Order | null>(null);
 const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const toast = useToast();
  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  useEffect(() => {
   const unsubOrders = subscribeOrders(
    (rows) => {
     setOrders(rows);
     // Keep an open detail modal live: re-resolve the selected order
     // from the fresh snapshot so status/payment edits reflect without
     // closing and reopening. Falls back to the last-known snapshot if
     // the row vanished (e.g. deleted elsewhere).
     setSelected((prev) =>
      prev ? rows.find((r) => r.order_id === prev.order_id) ?? prev : prev,
     );
     setReady(true);
    },
    (e) => {
     onFeedError(e);
     // Don't leave the page on a spinner: render the error state.
     setReady(true);
    },
   );
   const unsubInv = subscribeInventory(setInventory, onFeedError);
   return () => {
    unsubOrders();
    unsubInv();
   };
  }, [feedNonce, onFeedError]);

 const tabs = [
  { id: "All", label: "All", count: orders.length },
  {
   id: "Overdue",
   label: "Overdue",
   count: orders.filter((o) => o.priority === "Overdue").length,
  },
  {
   id: "Urgent",
   label: "Urgent",
   count: orders.filter((o) => o.priority === "Urgent").length,
  },
  {
   id: "Upcoming",
   label: "Upcoming",
   count: orders.filter((o) => o.priority === "Upcoming").length,
  },
 ];

 const filtered =
  activePriority === "All"
   ? orders
   : orders.filter((o) => o.priority === activePriority);
 const searched = filtered.filter(
  (o) =>
   !searchValue ||
   `${o.order_id} ${o.customer_name} ${o.item_type}`
    .toLowerCase()
    .includes(searchValue.toLowerCase()),
 );

 const handleExport = () => {
  if (searched.length === 0) return;
  exportToCSV(searched);
  toast.success(`Exported ${searched.length} order${searched.length === 1 ? "" : "s"} to CSV`);
 };

 const cols = [
  {
   key: "order_id",
   header: "Order ID",
   render: (r: Order) => <span className="type-mono">{r.order_id}</span>,
  },
  {
   key: "customer_name",
   header: "Customer",
   render: (r: Order) => (
    <div className="flex flex-col">
     <span className="text-sm font-medium text-printflow-on-surface">
      {r.customer_name}
     </span>
     {r.customer_city ? (
      <span className="text-[10px] text-printflow-on-surface-variant">
       {r.customer_city}
       {r.customer_province ? `, ${r.customer_province}` : ""}
      </span>
     ) : null}
    </div>
   ),
  },
  { key: "item_type", header: "Item Type" },
  {
   key: "quantity",
   header: "Qty",
   render: (r: Order) => r.quantity.toLocaleString(),
  },
  {
   key: "layout_file",
   header: "Layout",
   render: (r: Order) => <LayoutPreview value={r.layout_file} size={48} />,
  },
  { key: "target_date", header: "Target Date" },
  {
   key: "priority",
   header: "Priority",
   render: (r: Order) => (
    <PriorityBadge
     priority={r.priority.toLowerCase() as "overdue" | "urgent" | "upcoming"}
    />
   ),
  },
  {
   key: "status",
   header: "Status",
   render: (r: Order) => (
    <StatusBadge
     status={r.status.toLowerCase().replace(/\s+/g, "-") as any}
     customLabel={r.status}
    />
   ),
  },
  {
   key: "estimated_completion",
   header: "ETA",
   render: (r: Order) => {
    const days = Math.ceil(
     (new Date(r.estimated_completion).getTime() - new Date(r.target_date).getTime()) /
      (1000 * 60 * 60 * 24),
    );
    const tone =
     days < 0
      ? "text-printflow-error"
      : days === 0
       ? "text-printflow-warning"
       : "text-printflow-on-surface";
    return (
     <div className="flex flex-col">
      <span className="text-xs font-medium">{r.estimated_completion}</span>
      <span className={`text-[10px] ${tone}`}>
       {days < 0
        ? `${Math.abs(days)}d after target`
        : days === 0
         ? "on target"
         : `${days}d from target`}
      </span>
     </div>
    );
   },
  },
  {
   key: "payment_amount",
   header: "Payment",
   render: (r: Order) => `₱${r.payment_amount.toLocaleString()}`,
  },
  {
   key: "actions",
   header: "",
   render: (r: Order) => (
    <button
     onClick={(e) => {
      e.stopPropagation();
      setSelected(r);
      setOpen(true);
     }}
     className="text-printflow-on-surface-variant hover:text-printflow-primary transition-colors"
     aria-label={`View ${r.order_id}`}
    >
     <Eye className="w-4 h-4" />
    </button>
   ),
  },
 ];

 return (
   <AdminLayout
    title="Orders"
    subtitle="Monitor customer orders and priorities"
   >
    {feedError && (
     <FeedErrorBanner
      message={feedError}
      showCached={orders.length > 0}
      onRetry={retryFeed}
     />
    )}
    <ContentCard title="All Orders" subtitle={`${searched.length} orders`}>
    <FilterToolbar
     tabs={tabs}
     activeTab={activePriority}
     onTabChange={setActivePriority}
     searchPlaceholder="Search order or customer"
     onSearchChange={setSearchValue}
     searchValue={searchValue}
     customActions={
      <Button variant="secondary" onClick={handleExport} disabled={searched.length === 0}>
       <Download className="w-4 h-4" />
       Export
      </Button>
     }
    />
    {ready && orders.length === 0 ? (
     <EmptyState
      icon={<ShoppingBag className="w-7 h-7" />}
      title="No orders yet"
      description="Open the Cashier POS app to create the first one - it will appear here in real time."
     />
    ) : (
       <DataTable
        columns={cols}
        data={searched}
        keyExtractor={(r) => r.order_id}
        onRowClick={(r) => {
         setSelected(r);
         setOpen(true);
        }}
        emptyMessage="No orders"
        pageSize={25}
        loading={!ready}
       />
    )}
   </ContentCard>

   <Modal
    isOpen={open}
    onClose={() => {
     setOpen(false);
     setSelected(null);
    }}
    title={selected ? `Order ${selected.order_id}` : "Order Details"}
    description={selected ? `${selected.customer_name} - ${selected.item_type}` : undefined}
    icon={<ShoppingCart className="w-5 h-5" />}
    size="lg"
    footer={
     <Button
      variant="secondary"
      onClick={() => {
       setOpen(false);
       setSelected(null);
      }}
     >
      Close
     </Button>
    }
   >
    {selected &&
     (() => {
      const related = inventory.find(
       (i) =>
        i.item_type === selected.item_type ||
        selected.item_type.toLowerCase().includes(i.category.toLowerCase()),
      );
      const isLow = related
       ? related.current_stock <= related.reorder_point
       : false;
      return (
       <div className="space-y-5">
        {isLow && related && (
         <div className="flex items-start gap-2.5 p-3.5 bg-printflow-error-container/20 border border-printflow-error-container/40 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-printflow-error shrink-0 mt-0.5" />
          <div>
           <p className="text-sm font-semibold text-printflow-on-error-container">
            Insufficient stock indicator
           </p>
           <p className="text-xs text-printflow-on-surface-variant">
             Material {related.material_variant_id} ({related.item_type}) - stock{" "}
             {related.current_stock} {"<="} ROP {related.reorder_point} (prompts restock
             per Workflow VII).
           </p>
          </div>
         </div>
        )}

        <div className="flex items-center justify-between p-4 bg-printflow-surface-container/50 rounded-xl border border-printflow-outline-variant/40">
         <div>
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           ORDER ID
          </p>
          <p className="type-mono font-bold text-printflow-on-surface leading-tight">
           {selected.order_id}
          </p>
         </div>
         <div className="flex items-center gap-2">
          <PriorityBadge
           priority={
            selected.priority.toLowerCase() as
             | "overdue"
             | "urgent"
             | "upcoming"
           }
          />
          <StatusBadge
           status={selected.status.toLowerCase().replace(/\s+/g, "-") as any}
           customLabel={selected.status}
          />
         </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
         <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           CUSTOMER
          </p>
          <p className="text-sm font-medium text-printflow-on-surface mt-1">
           {selected.customer_name}
          </p>
         </div>
         <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           EMAIL
          </p>
          <p className="text-sm font-medium text-printflow-on-surface mt-1 truncate">
           {selected.customer_email || "-"}
          </p>
         </div>
         <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           PHONE
          </p>
          <p className="text-sm font-medium text-printflow-on-surface mt-1">
           {selected.customer_phone || "-"}
          </p>
         </div>
        </div>

        {(selected.customer_region ||
         selected.customer_province ||
         selected.customer_city ||
         selected.customer_barangay ||
         selected.customer_zip) && (
         <div className="p-3.5 bg-printflow-surface-container/40 rounded-xl border border-printflow-outline-variant/40 flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-printflow-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
           <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
            ADDRESS
           </p>
           <p className="text-sm font-medium text-printflow-on-surface mt-1">
            {[
             selected.customer_barangay,
             selected.customer_city,
             selected.customer_province,
             selected.customer_zip,
            ]
             .filter((p): p is string => Boolean(p && p.length))
             .join(", ")}
            {selected.customer_region ? ` - ${selected.customer_region}` : ""}
           </p>
          </div>
         </div>
        )}

        <div className="grid grid-cols-2 gap-3">
         <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           ITEM TYPE
          </p>
          <p className="text-sm font-medium text-printflow-on-surface mt-1">
           {selected.item_type}
          </p>
         </div>
         <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           QUANTITY
          </p>
          <p className="text-sm font-medium text-printflow-on-surface mt-1">
           {selected.quantity.toLocaleString()} pcs
          </p>
         </div>
          <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
           <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
            LAYOUT FILE
           </p>
           <div className="mt-1">
            <LayoutPreview value={selected.layout_file} size={96} />
           </div>
          </div>
         <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           TARGET DATE
          </p>
          <p className="text-sm font-medium text-printflow-on-surface mt-1">
           {selected.target_date}
          </p>
         </div>
         <div className="p-3.5 bg-printflow-primary/5 rounded-xl border border-printflow-primary/20">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           ESTIMATED COMPLETION
          </p>
          <p className="text-sm font-bold text-printflow-primary mt-1">
           {selected.estimated_completion}
          </p>
          {selected.based_on && selected.based_on.length > 0 && (
           <div
            className="flex flex-wrap items-center gap-1 mt-1.5"
            title="ETA = backlog + job_complexity + capacity"
           >
            <span className="text-[10px] text-printflow-on-surface-variant">
             Based on:
            </span>
            {selected.based_on.map((b) => (
             <span
              key={b}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-printflow-primary/10 text-printflow-primary font-medium"
             >
              {b.replace(/_/g, " ")}
             </span>
            ))}
           </div>
          )}
         </div>
         <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           STATUS
          </p>
          <div className="mt-1.5">
           <StatusBadge
            status={selected.status.toLowerCase().replace(/\s+/g, "-") as any}
            customLabel={selected.status}
           />
          </div>
         </div>
         <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           PAYMENT
          </p>
          <p className="text-sm font-medium text-printflow-on-surface mt-1">
           ₱{selected.payment_amount.toLocaleString()}
          </p>
         </div>
         <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           PAID STATUS
          </p>
          <div className="mt-1.5">
           <PaymentBadge
            status={toPaymentStatus(selected.payment_status)}
           />
          </div>
         </div>
        </div>
       </div>
      );
     })()}
   </Modal>
  </AdminLayout>
 );
}

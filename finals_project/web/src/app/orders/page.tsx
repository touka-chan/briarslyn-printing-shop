"use client";

import { useState } from "react";
import { Eye, Download, ShoppingCart, AlertTriangle } from "lucide-react";
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
 useToast,
} from "@/components/ui";
import { toPaymentStatus } from "@/components/ui/PaymentBadge";
import { mockOrders, mockInventory } from "@/lib/mockData";
import { Order } from "@/types";

function exportToCSV(rows: Order[]) {
 const headers = [
  "order_id",
  "customer_name",
  "item_type",
  "quantity",
  "target_date",
  "priority",
  "status",
  "estimated_completion",
  "payment_amount",
  "payment_status",
 ];
 const lines = [
  headers.join(","),
  ...rows.map((r) =>
   [
    r.order_id,
    `"${r.customer_name}"`,
    `"${r.item_type}"`,
    r.quantity,
    r.target_date,
    r.priority,
    r.status,
    r.estimated_completion,
    r.payment_amount,
    r.payment_status ?? "Unpaid",
   ].join(","),
  ),
 ];
 const blob = new Blob([lines.join("\n")], { type: "text/csv" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
 document.body.appendChild(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url);
}

export default function OrdersPage() {
 const [activePriority, setActivePriority] = useState("All");
 const [searchValue, setSearchValue] = useState("");
 const [selected, setSelected] = useState<Order | null>(null);
 const [open, setOpen] = useState(false);
 const toast = useToast();

 const tabs = [
  { id: "All", label: "All", count: mockOrders.length },
  {
   id: "Overdue",
   label: "Overdue",
   count: mockOrders.filter((o) => o.priority === "Overdue").length,
  },
  {
   id: "Urgent",
   label: "Urgent",
   count: mockOrders.filter((o) => o.priority === "Urgent").length,
  },
  {
   id: "Upcoming",
   label: "Upcoming",
   count: mockOrders.filter((o) => o.priority === "Upcoming").length,
  },
 ];

 const filtered =
  activePriority === "All"
   ? mockOrders
   : mockOrders.filter((o) => o.priority === activePriority);
 const searched = filtered.filter(
  (o) =>
   !searchValue ||
   `${o.order_id} ${o.customer_name} ${o.item_type}`
    .toLowerCase()
    .includes(searchValue.toLowerCase()),
 );

 const handleExport = () => {
  exportToCSV(searched);
  toast.success(`Exported ${searched.length} order${searched.length === 1 ? "" : "s"} to CSV`);
 };

 const cols = [
  {
   key: "order_id",
   header: "Order ID",
   render: (r: Order) => <span className="type-mono">{r.order_id}</span>,
  },
  { key: "customer_name", header: "Customer" },
  { key: "item_type", header: "Item Type" },
  {
   key: "quantity",
   header: "Qty",
   render: (r: Order) => r.quantity.toLocaleString(),
  },
  {
   key: "layout_file",
   header: "Layout",
   render: (r: Order) => (
    <span className="text-xs underline decoration-dotted">
     {r.layout_file}
    </span>
   ),
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
   render: (r: Order) => <span className="text-xs">{r.estimated_completion}</span>,
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
   onSearch={setSearchValue}
  >
   <ContentCard title="All Orders" subtitle={`${searched.length} orders`}>
    <FilterToolbar
     tabs={tabs}
     activeTab={activePriority}
     onTabChange={setActivePriority}
     searchPlaceholder="Search order or customer"
     onSearchChange={setSearchValue}
     searchValue={searchValue}
     customActions={
      <Button variant="secondary" onClick={handleExport}>
       <Download className="w-4 h-4" />
       Export
      </Button>
     }
    />
    <DataTable
     columns={cols}
     data={searched}
     keyExtractor={(r) => r.order_id}
     onRowClick={(r) => {
      setSelected(r);
      setOpen(true);
     }}
     emptyMessage="No orders"
    />
   </ContentCard>

   <Modal
    isOpen={open}
    onClose={() => {
     setOpen(false);
     setSelected(null);
    }}
    title={selected ? `Order ${selected.order_id}` : "Order Details"}
    description={selected ? `${selected.customer_name} • ${selected.item_type}` : undefined}
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
      const related = mockInventory.find(
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
            Material {related.material_variant_id} ({related.item_type}) — stock{" "}
            {related.current_stock} ≤ ROP {related.reorder_point} (prompts restock
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
           {selected.customer_email || "—"}
          </p>
         </div>
         <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
           PHONE
          </p>
          <p className="text-sm font-medium text-printflow-on-surface mt-1">
           {selected.customer_phone || "—"}
          </p>
         </div>
        </div>

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
          <p className="text-sm font-medium text-printflow-primary mt-1 underline decoration-dotted cursor-pointer">
           {selected.layout_file}
          </p>
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
           <p
            className="text-[10px] text-printflow-on-surface-variant mt-1"
            title="ETA = backlog + job_complexity + capacity"
           >
            Based on: {selected.based_on.join(", ")}
           </p>
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

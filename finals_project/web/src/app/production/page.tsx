"use client";

import { useEffect, useState } from "react";
import { Eye, Download, Factory, Check, Inbox } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
  ContentCard,
  FilterToolbar,
  DataTable,
  StatusBadge,
  Button,
  Modal,
  PriorityBadge,
  EmptyState,
  FeedErrorBanner,
  useToast,
} from "@/components/ui";
import { subscribeOrders } from "@/lib/services/orders";
import { updateOrderStatus } from "@/lib/services/orders";
import { getPriority, priorityWeight } from "@/lib/derived";
import { csvRow, downloadCsv } from "@/lib/csv";
import { useFeedStatus } from "@/lib/useFeedStatus";
import type { Order, ProductionJob } from "@/types";

const STATUSES: ProductionJob["status"][] = [
 "Pending",
 "In Production",
 "Ready for Pickup",
 "Completed",
];

function orderToJob(o: Order): ProductionJob {
 return {
  id: o.id ?? o.order_id,
  order_id: o.order_id,
  item_type: o.item_type,
  priority: o.priority ?? getPriority(o),
  status: o.status as ProductionJob["status"],
  target_date: o.target_date,
  estimated_completion: o.estimated_completion,
  based_on: o.based_on,
 };
}

export default function ProductionPage() {
 const [orders, setOrders] = useState<Order[]>([]);
 const [ready, setReady] = useState(false);
 const [active, setActive] = useState("All");
 const [search, setSearch] = useState("");
 const [sel, setSel] = useState<ProductionJob | null>(null);
 const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  useEffect(() => {
   const unsub = subscribeOrders(
    (rows) => {
     setOrders(rows);
     // Keep an open job modal live: re-resolve from the fresh snapshot
     // so edits from elsewhere (mobile, other tabs) reflect. Falls back
     // to the last-known snapshot if the row left the queue.
     setSel((prev) => {
      if (!prev) return prev;
      const fresh = rows.find((r) => r.order_id === prev.order_id);
      if (!fresh) return prev;
      return { ...prev, ...orderToJob(fresh) };
     });
     setReady(true);
    },
    (e) => {
     onFeedError(e);
     // Don't leave the page on a spinner: render the error state.
     setReady(true);
    },
   );
   return () => unsub();
  }, [feedNonce, onFeedError]);

 const queue: ProductionJob[] = orders
  .filter(
   (o) =>
    o.status === "Pending" ||
    o.status === "In Production" ||
    o.status === "Ready for Pickup",
  )
  .map(orderToJob);

 const tabs = [
  { id: "All", label: "All", count: queue.length },
  {
   id: "Overdue",
   label: "Overdue",
   count: queue.filter((p) => p.priority === "Overdue").length,
  },
  {
   id: "Urgent",
   label: "Urgent",
   count: queue.filter((p) => p.priority === "Urgent").length,
  },
  {
   id: "Upcoming",
   label: "Upcoming",
   count: queue.filter((p) => p.priority === "Upcoming").length,
  },
 ];

 const filtered =
  active === "All"
   ? [...queue].sort(
    (a, b) =>
     priorityWeight(a.priority) - priorityWeight(b.priority) ||
     a.target_date.localeCompare(b.target_date),
   )
   : queue
    .filter((p) => p.priority === active)
    .sort((a, b) => a.target_date.localeCompare(b.target_date));
 const searched = filtered.filter(
  (p) =>
   !search ||
   `${p.order_id} ${p.item_type}`.toLowerCase().includes(search.toLowerCase()),
 );

  // Stages must be walked in order: jumping forward over "In Production"
  // skips the recipe auto-deduct (it fires only on entering production).
  // Same-status, one step forward, and one step back are allowed.
  const canMove = (
   from: ProductionJob["status"],
   to: ProductionJob["status"],
  ): boolean => {
   const d = STATUSES.indexOf(to) - STATUSES.indexOf(from);
   return d === 0 || d === 1 || d === -1;
  };

   const changeStatus = async (orderId: string, next: ProductionJob["status"]) => {
    const cur = queue.find((j) => j.order_id === orderId)?.status;
    if (cur && !canMove(cur, next)) {
     toast.error(
      `Move through each stage in order - ${cur} - ${next} would skip stock deduction.`,
     );
     return;
    }
    const prev = sel && sel.order_id === orderId ? sel.status : undefined;
   setSel((p) => (p && p.order_id === orderId ? { ...p, status: next } : p));
   setSaving(true);
   try {
    await updateOrderStatus(orderId, next);
    toast.success(`${orderId} - ${next}`);
   } catch (e) {
    // Roll back the optimistic modal so the UI matches the server.
    if (prev) {
     setSel((p) => (p && p.order_id === orderId ? { ...p, status: prev } : p));
    }
    toast.error(
     e instanceof Error && e.message
      ? `Failed to update status: ${e.message}`
      : "Failed to update status - please try again.",
    );
   } finally {
    setSaving(false);
   }
  };

 const exportCSV = () => {
  if (searched.length === 0) return;
  const headers = ["order_id", "item_type", "priority", "status", "target_date", "eta"];
  const lines = [
   headers.join(","),
   ...searched.map((r) =>
    csvRow([
     r.order_id,
     r.item_type,
     r.priority,
     r.status,
     r.target_date,
     r.estimated_completion,
    ]),
   ),
  ];
  downloadCsv(`production-${new Date().toISOString().slice(0, 10)}.csv`, lines);
  toast.success(`Exported ${searched.length} jobs`);
 };

 const cols = [
  {
   key: "order_id",
   header: "Order ID",
   render: (r: ProductionJob) => (
    <span className="type-mono">{r.order_id}</span>
   ),
  },
  { key: "item_type", header: "Item Type" },
  {
   key: "priority",
   header: "Priority",
   render: (r: ProductionJob) => (
    <PriorityBadge
     priority={r.priority.toLowerCase() as "overdue" | "urgent" | "upcoming"}
    />
   ),
  },
  {
   key: "status",
   header: "Status",
   render: (r: ProductionJob) => (
    <span className="flex items-center gap-2">
     <StatusBadge
      status={r.status.toLowerCase().replace(/\s+/g, "-") as any}
      customLabel={r.status}
     />
     <select
      value={r.status}
      onChange={(e) =>
       changeStatus(r.order_id, e.target.value as ProductionJob["status"])
      }
      onClick={(e) => e.stopPropagation()}
      disabled={saving}
      className="text-xs px-1.5 py-0.5 rounded border border-printflow-outline-variant bg-printflow-surface text-printflow-on-surface focus:outline-none focus:ring-1 focus:ring-printflow-primary disabled:opacity-50"
      aria-label={`Change status for ${r.order_id}`}
     >
      {STATUSES.map((s) => (
        <option key={s} value={s} disabled={!canMove(r.status, s)}>
         {s}
        </option>
       ))}
     </select>
    </span>
   ),
  },
  { key: "target_date", header: "Target Date" },
  {
   key: "estimated_completion",
   header: "ETA",
   render: (r: ProductionJob) => (
    <div className="flex flex-col gap-1">
     <span className="text-xs font-semibold">{r.estimated_completion}</span>
     {r.based_on && r.based_on.length > 0 && (
      <div className="flex gap-1 flex-wrap">
       {r.based_on.map((factor) => (
        <span
         key={factor}
         className="text-[9px] px-1 py-0.2 rounded border border-printflow-primary/20 bg-printflow-primary/5 text-printflow-primary uppercase type-mono"
        >
         {factor.replace("_", " ")}
        </span>
       ))}
      </div>
     )}
    </div>
   ),
  },
  {
   key: "actions",
   header: "",
   render: (r: ProductionJob) => (
    <button
     onClick={(e) => {
      e.stopPropagation();
      setSel(r);
      setOpen(true);
     }}
     className="text-printflow-on-surface-variant hover:text-printflow-primary transition-colors"
     aria-label={`Open ${r.order_id}`}
    >
     <Eye className="w-4 h-4" />
    </button>
   ),
  },
 ];

 return (
   <AdminLayout
    title="Production"
    subtitle="Production queue by priority"
    onSearch={setSearch}
   >
    {feedError && (
     <FeedErrorBanner
      message={feedError}
      showCached={orders.length > 0}
      onRetry={retryFeed}
     />
    )}
    <ContentCard title="Production Queue" subtitle={`${searched.length} orders`}>
    <FilterToolbar
     tabs={tabs}
     activeTab={active}
     onTabChange={setActive}
     searchPlaceholder="Search order"
     onSearchChange={setSearch}
     searchValue={search}
     customActions={
      <Button
       variant="secondary"
       onClick={exportCSV}
       disabled={searched.length === 0}
      >
       <Download className="w-4 h-4" />
       Export
      </Button>
     }
    />
    {ready && queue.length === 0 ? (
     <EmptyState
      icon={<Inbox className="w-7 h-7" />}
      title="No production queue"
      description="Orders will appear here once they enter Pending or In Production."
     />
    ) : (
      <DataTable
       columns={cols}
       data={searched}
       keyExtractor={(r) => r.order_id}
       onRowClick={(r) => {
        setSel(r);
        setOpen(true);
       }}
       emptyMessage="No production queue"
       pageSize={25}
      />
    )}
   </ContentCard>

   <Modal
    isOpen={open}
    onClose={() => {
     setOpen(false);
     setSel(null);
    }}
    title={sel ? `Production ${sel.order_id}` : "Production"}
    description={sel ? `${sel.item_type} - ${sel.priority}` : undefined}
    icon={<Factory className="w-5 h-5" />}
    size="lg"
    footer={
     <div className="flex gap-2">
      {sel && (() => {
       const idx = STATUSES.indexOf(sel.status);
       const next = STATUSES[idx + 1];
       return (
        <Button
         variant="primary"
         onClick={() => {
          if (next) changeStatus(sel.order_id, next);
         }}
         disabled={!next || saving}
        >
         <Check className="w-4 h-4" />
         {next ? `Advance to ${next}` : "Completed"}
        </Button>
       );
      })()}
      <Button
       variant="secondary"
       onClick={() => {
        setOpen(false);
        setSel(null);
       }}
      >
       Close
      </Button>
     </div>
    }
   >
    {sel && (
     <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-printflow-surface-container/50 rounded-xl border border-printflow-outline-variant/40">
       <div>
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
         ORDER ID
        </p>
        <p className="type-mono font-bold text-printflow-on-surface">
         {sel.order_id}
        </p>
       </div>
       <PriorityBadge
        priority={
         sel.priority.toLowerCase() as "overdue" | "urgent" | "upcoming"
        }
       />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
         ITEM TYPE
        </p>
        <p className="text-sm font-medium mt-1">{sel.item_type}</p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
         STATUS
        </p>
        <div className="mt-1.5">
         <StatusBadge
          status={sel.status.toLowerCase().replace(/\s+/g, "-") as any}
          customLabel={sel.status}
         />
        </div>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
         TARGET DATE
        </p>
        <p className="text-sm font-medium mt-1">{sel.target_date}</p>
       </div>
       <div className="p-3.5 bg-printflow-primary/5 rounded-xl border border-printflow-primary/20">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
         ESTIMATED COMPLETION
        </p>
        <p
         className="text-sm font-bold text-printflow-primary mt-1"
         title="ETA = backlog + job_complexity + capacity"
        >
         {sel.estimated_completion}
        </p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 col-span-1 sm:col-span-2">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant mb-2">
         QUEUE FACTORS / MODEL RATIONALE
        </p>
        <div className="flex gap-1.5 flex-wrap">
         {sel.based_on && sel.based_on.length > 0 ? (
          sel.based_on.map((factor) => (
           <span
            key={factor}
            className="text-xs px-2.5 py-0.5 rounded-full border border-printflow-primary/20 bg-printflow-primary/5 text-printflow-primary type-mono"
           >
            {factor === "backlog"
             ? "Shop Backlog (Active Queue Depth)"
             : factor === "job_complexity"
             ? "Job Complexity Index"
             : "Current Capacity Limit (Staffing)"}
           </span>
          ))
         ) : (
          <span className="text-xs text-printflow-on-surface-variant/60">
           Determined by scheduler baseline
          </span>
         )}
        </div>
       </div>
      </div>
     </div>
    )}
   </Modal>
  </AdminLayout>
 );
}

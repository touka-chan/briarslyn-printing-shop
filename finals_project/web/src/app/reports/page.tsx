"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import {
 Download,
 FileText,
 Factory,
 Package,
 Check,
 ShoppingCart,
 Clock,
 AlertTriangle,
 Inbox,
} from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
 ContentCard,
 FilterToolbar,
 Button,
 ChartCard,
 KpiCard,
 FeedErrorBanner,
 useToast,
 Modal,
 DataTable,
 StatusBadge,
 PriorityBadge,
 PaymentBadge,
 EmptyState,
} from "@/components/ui";
import { toPaymentStatus } from "@/components/ui/PaymentBadge";
import { subscribeOrders } from "@/lib/services/orders";
import { subscribeInventory } from "@/lib/services/inventory";
import { useFeedStatus } from "@/lib/useFeedStatus";
import {
  useSparkSeries,
  orderCreatedAtKey,
  inventoryCheckoutKey,
} from "@/lib/hooks/useSparkSeries";
import { getInventoryStatus } from "@/lib/derived";
import { csvRow, downloadCsv } from "@/lib/csv";
import type { Order, InventoryItem } from "@/types";

const baseTimeRanges = [
 { id: "week", label: "This Week" },
 { id: "month", label: "This Month" },
 { id: "quarter", label: "This Quarter" },
];

function todayIso(): string {
 return new Date().toISOString().slice(0, 10);
}

function rangeStart(range: string): string {
 const t = new Date();
 if (range === "week") {
  const d = new Date(t);
  d.setDate(t.getDate() - 6);
  return d.toISOString().slice(0, 10);
 }
 if (range === "month") {
  const d = new Date(t);
  d.setDate(t.getDate() - 29);
  return d.toISOString().slice(0, 10);
 }
 if (range === "quarter") {
  const d = new Date(t);
  d.setDate(t.getDate() - 89);
  return d.toISOString().slice(0, 10);
 }
 return "0000-00-00";
}

export default function ReportsPage() {
 const [activeRange, setActiveRange] = useState("month");
 const [customFrom, setCustomFrom] = useState(() => {
  const d = new Date();
  d.setDate(d.getDate() - 19);
  return d.toISOString().slice(0, 10);
 });
  const [customTo, setCustomTo] = useState(todayIso());
  const [customOn, setCustomOn] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const toast = useToast();
  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  const timeRanges = useMemo(
   () => [
    ...baseTimeRanges,
    ...(customOn ? [{ id: "custom", label: "Custom" }] : []),
   ],
   [customOn],
  );

  // Display bounds for the active range (custom uses the picked dates).
  const rangeLabel = () =>
   activeRange === "custom"
    ? `${customFrom} to ${customTo}`
    : `${rangeStart(activeRange)} to ${todayIso()}`;

  useEffect(() => {
   const unsubOrders = subscribeOrders(setOrders, onFeedError);
   const unsubInv = subscribeInventory(setInventory, onFeedError);
   return () => {
    unsubOrders();
    unsubInv();
   };
  }, [feedNonce, onFeedError]);

 const lowStock = useMemo(
  () =>
   inventory.filter(
    (i) =>
     getInventoryStatus(i) === "Low Stock" ||
     getInventoryStatus(i) === "Insufficient Stock",
   ).length,
  [inventory],
 );
 const pending = orders.filter((o) => o.status === "Pending").length;
 const completed = orders.filter((o) => o.status === "Completed").length;
 const inProduction = orders.filter(
  (o) => o.status === "In Production" || o.status === "Ready for Pickup",
 ).length;

 // Live sparkline series - last 7 days, local TZ.
 const ordersSpark = useSparkSeries(orders, orderCreatedAtKey, 7);
 const pendingSpark = useSparkSeries(
  orders.filter((o) =>
   ["Pending", "In Production", "Ready for Pickup"].includes(o.status),
  ),
  orderCreatedAtKey,
  7,
 );
 const completedSpark = useSparkSeries(
  orders.filter((o) => o.status === "Completed"),
  orderCreatedAtKey,
  7,
 );
 const lowStockSpark = useSparkSeries(inventory, inventoryCheckoutKey, 7);

 const productionSummary = useMemo(
  () => [
   { name: "Pending", value: pending },
   { name: "In Production", value: inProduction },
   { name: "Completed", value: completed },
  ],
  [pending, inProduction, completed],
 );

 const priorityBreakdown = useMemo(() => {
  const counts: Record<string, number> = { Overdue: 0, Urgent: 0, Upcoming: 0 };
  for (const o of orders) {
   const p = o.priority ?? "Upcoming";
   counts[p] = (counts[p] ?? 0) + 1;
  }
  return [
   { name: "Overdue", value: counts.Overdue },
   { name: "Urgent", value: counts.Urgent },
   { name: "Upcoming", value: counts.Upcoming },
  ];
 }, [orders]);

 const inventoryByStatus = useMemo(() => {
  const counts: Record<string, number> = {
   "In Stock": 0,
   "Low Stock": 0,
   "Insufficient Stock": 0,
  };
  for (const i of inventory) {
   const s = getInventoryStatus(i);
   counts[s] = (counts[s] ?? 0) + 1;
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
 }, [inventory]);

 const [kpiModal, setKpiModal] = useState<
 null | "total" | "pending" | "completed" | "lowStock"
 >(null);

  const rangeFilter = (iso: string) => {
   if (activeRange === "custom") {
    return iso >= customFrom && iso <= customTo;
   }
   const start = rangeStart(activeRange);
   return iso >= start && iso <= todayIso();
  };

   const ordersInRange = useMemo(
    // Range by CREATED date (when the order was placed) - never by
    // target_date: upcoming orders carry future deadlines and a
    // `<= today` cutoff would silently drop them from every KPI/modal.
    () =>
     orders.filter((o) =>
      rangeFilter((o.created_at ?? o.target_date ?? "").slice(0, 10)),
     ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, activeRange, customOn, customFrom, customTo],
   );
  // Card numbers follow the selected range (same pool the modals list),
  // so the KPI value always matches the modal row count.
  const totalInRange = ordersInRange.length;
  const pendingInRange = useMemo(
   () => ordersInRange.filter((o) => o.status === "Pending").length,
   [ordersInRange],
  );
  const completedInRange = useMemo(
   () => ordersInRange.filter((o) => o.status === "Completed").length,
   [ordersInRange],
  );
 const inventoryInRange = useMemo(
  () =>
   inventory.filter(
    (i) =>
     getInventoryStatus(i) === "Low Stock" ||
     getInventoryStatus(i) === "Insufficient Stock",
   ),
  [inventory],
 );

 const drillDown = useMemo(() => {
  if (kpiModal === "total") return ordersInRange;
  if (kpiModal === "pending")
   return ordersInRange.filter((o) => o.status === "Pending");
  if (kpiModal === "completed")
   return ordersInRange.filter((o) => o.status === "Completed");
  if (kpiModal === "lowStock") return inventoryInRange;
  return [] as (Order | InventoryItem)[];
 }, [kpiModal, ordersInRange, inventoryInRange]);

 const handleDownloadCSV = (rows: (Order | InventoryItem)[], label: string) => {
  if (rows.length === 0) {
   toast.error("No data to export");
   return;
  }
  const sample = rows[0] as any;
  const isOrder = "order_id" in sample;
  const headers = isOrder
   ? [
   "order_id",
   "customer_name",
   "item_type",
   "quantity",
   "target_date",
   "priority",
   "status",
   "payment_status",
   "payment_amount",
   ]
   : [
   "material_variant_id",
   "item_type",
   "category",
   "current_stock",
   "reorder_point",
   "forecasted_demand_next_7_days",
   "status",
   ];
  const lines = [
   headers.join(","),
   ...rows.map((r: any) => csvRow(headers.map((h) => r[h] ?? ""))),
  ];
  downloadCsv(`${label.toLowerCase().replace(/\s+/g, "-")}-${todayIso()}.csv`, lines);
  toast.success(`Exported ${rows.length} rows`);
 };

 const handleDownloadPDF = (label: string) => {
  document.body.classList.add("print-mode");
  const cleanup = () => {
   document.body.classList.remove("print-mode");
   window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  toast.success(`Generating ${label} (PDF) - use the browser print dialog`);
 };

  const handleCustomRangeApply = () => {
   if (!customFrom || !customTo || customFrom > customTo) {
    toast.error("Invalid date range");
    return;
   }
   // Actually switch the page onto the custom window (previously this
   // only toasted while every filter kept using the preset range).
   setCustomOn(true);
   setActiveRange("custom");
   toast.success(`Custom range applied: ${customFrom} - ${customTo}`);
  };

 const orderColumns: {
  key: string;
  header: string;
  render?: (r: Order) => ReactNode;
 }[] = [
  {
   key: "order_id",
   header: "Order",
   render: (r) => <span className="type-mono">{r.order_id}</span>,
  },
  { key: "customer_name", header: "Customer" },
  { key: "item_type", header: "Item" },
  {
   key: "quantity",
   header: "Qty",
   render: (r) => r.quantity.toLocaleString(),
  },
  { key: "target_date", header: "Target" },
  {
   key: "priority",
   header: "Priority",
   render: (r) => (
    <PriorityBadge
     priority={r.priority.toLowerCase() as "overdue" | "urgent" | "upcoming"}
    />
   ),
  },
  {
   key: "status",
   header: "Status",
   render: (r) => (
    <StatusBadge
     status={r.status.toLowerCase() as any}
     customLabel={r.status}
    />
   ),
  },
  {
   key: "view",
   header: "Payment",
   render: (r) => <PaymentBadge status={toPaymentStatus(r.payment_status)} />,
  },
 ];

 const inventoryColumns = [
  {
   key: "material_variant_id",
   header: "Variant",
   render: (r: InventoryItem) => (
    <span className="type-mono">{r.material_variant_id}</span>
   ),
  },
  { key: "item_type", header: "Item" },
  { key: "category", header: "Category" },
  { key: "current_stock", header: "Stock" },
  { key: "reorder_point", header: "ROP" },
  { key: "forecasted_demand_next_7_days", header: "Fcst 7d" },
  {
   key: "status",
   header: "Status",
   render: (r: InventoryItem) => (
    <StatusBadge
     status={getInventoryStatus(r).toLowerCase().replace(/\s+/g, "-") as any}
     customLabel={getInventoryStatus(r)}
    />
   ),
  },
 ];

  const pluralOrders = (n: number) =>
   n === 1 ? "1 order" : `${n} orders`;

  const kpiMeta: Record<
   NonNullable<typeof kpiModal>,
   { title: string; desc: string; icon: ReactNode; count: number }
  > = {
   total: {
    title: "Total Orders",
    desc: `${pluralOrders(drillDown.length)} in selected range`,
    icon: <ShoppingCart className="w-5 h-5" />,
    count: drillDown.length,
   },
   pending: {
    title: "Pending Orders",
    desc: `${pluralOrders(drillDown.length)} awaiting production in range`,
    icon: <Clock className="w-5 h-5" />,
    count: drillDown.length,
   },
   completed: {
    title: "Completed Orders",
    desc: `${pluralOrders(drillDown.length)} fulfilled in range`,
    icon: <Check className="w-5 h-5" />,
    count: drillDown.length,
   },
   lowStock: {
    title: "Need Reorder",
    desc: `${drillDown.length} materials below reorder point (low + insufficient)`,
    icon: <AlertTriangle className="w-5 h-5" />,
    count: drillDown.length,
   },
  };

  return (
   <AdminLayout
    title="Reports"
    subtitle="Generate and download operational reports"
   >
    {feedError && (
     <FeedErrorBanner
      message={feedError}
      showCached={orders.length > 0 || inventory.length > 0}
      onRetry={retryFeed}
     />
    )}
    <div className="space-y-8">
    <ContentCard title="Generate Report">
     <FilterToolbar
      tabs={timeRanges}
      activeTab={activeRange}
      onTabChange={setActiveRange}
     />
     <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
        CUSTOM RANGE
       </p>
       <div className="flex flex-wrap items-end gap-3">
        <div>
         <label className="block text-xs text-printflow-on-surface-variant mb-1">
          From
         </label>
         <input
          type="date"
          value={customFrom}
          onChange={(e) => setCustomFrom(e.target.value)}
          className="px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary"
         />
        </div>
        <div>
         <label className="block text-xs text-printflow-on-surface-variant mb-1">
          To
         </label>
         <input
          type="date"
          value={customTo}
          onChange={(e) => setCustomTo(e.target.value)}
          className="px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary"
         />
        </div>
        <Button variant="primary" onClick={handleCustomRangeApply}>
         <Check className="w-4 h-4" />
         Apply
        </Button>
       </div>
      </div>
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
        QUICK DOWNLOAD
       </p>
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button
         variant="primary"
         onClick={() => handleDownloadPDF("Orders Report")}
        >
         <FileText className="w-4 h-4" />
         Orders
        </Button>
        <Button
         variant="primary"
         onClick={() => handleDownloadCSV(inventory, "Inventory Report")}
        >
         <Package className="w-4 h-4" />
         Inventory
        </Button>
        <Button
         variant="primary"
         onClick={() => handleDownloadPDF("Production Report")}
        >
         <Factory className="w-4 h-4" />
         Production
        </Button>
       </div>
      </div>
     </div>
    </ContentCard>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
     <ContentCard
      title="Orders by Priority"
      subtitle="Distribution by target date"
      className="min-w-0 overflow-hidden"
     >
      <div className="pt-3">
       {orders.length === 0 ? (
        <EmptyChart />
       ) : (
        <ChartCard
         title=""
         type="bar"
         data={priorityBreakdown}
         xKey="name"
         yKeys={["value"]}
         colors={["var(--color-printflow-on-surface)"]}
         height={260}
         showLegend={false}
        />
       )}
      </div>
      <Button
       variant="secondary"
       className="mt-6 w-full"
       onClick={() => handleDownloadCSV(orders, "Orders PDF")}
      >
       <Download className="w-4 h-4" />
       Download Orders CSV
      </Button>
     </ContentCard>
     <ContentCard
      title="Stock by Status"
      subtitle="Current inventory status"
      className="min-w-0 overflow-hidden"
     >
      <div className="pt-3">
       {inventory.length === 0 ? (
        <EmptyChart />
       ) : (
        <ChartCard
         title=""
         type="pie"
         data={inventoryByStatus}
         xKey="name"
         yKeys={["value"]}
         height={260}
        />
       )}
      </div>
      <Button
       variant="secondary"
       className="mt-6 w-full"
       onClick={() => handleDownloadCSV(inventory, "Inventory CSV")}
      >
       <Download className="w-4 h-4" />
       Download Inventory CSV
      </Button>
     </ContentCard>
     <ContentCard
      title="Production Summary"
      subtitle="Overall operations"
      className="min-w-0 overflow-hidden"
     >
      <div className="pt-3">
       {orders.length === 0 ? (
        <EmptyChart />
       ) : (
        <ChartCard
         title=""
         type="pie"
         data={productionSummary}
         xKey="name"
         yKeys={["value"]}
         colors={["var(--color-printflow-on-surface)", "var(--color-printflow-on-surface-variant)", "var(--color-printflow-outline)"]}
         height={260}
        />
       )}
      </div>
      <Button
       variant="secondary"
       className="mt-6 w-full"
       onClick={() => handleDownloadPDF("Production PDF")}
      >
       <Download className="w-4 h-4" />
       Download Production PDF
      </Button>
     </ContentCard>
    </div>

    <ContentCard title="Key Metrics">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
       <KpiCard
        label="Total Orders"
        value={totalInRange}
        icon="ShoppingCart"
        sparkline={ordersSpark}
        sparklineTone="primary"
        lastUpdated="Live"
        onClick={() => setKpiModal("total")}
       />
       <KpiCard
        label="Pending"
        value={pendingInRange}
        icon="Clock"
        sparkline={pendingSpark}
        sparklineTone="warning"
        lastUpdated="Live"
        onClick={() => setKpiModal("pending")}
       />
       <KpiCard
        label="Completed"
        value={completedInRange}
        icon="Check"
        sparkline={completedSpark}
        sparklineTone="success"
        lastUpdated="Live"
        onClick={() => setKpiModal("completed")}
       />
       <KpiCard
        label="Need Reorder"
        value={lowStock}
        icon="AlertTriangle"
        change={lowStock > 0 ? "low + insufficient" : "all stocked"}
        changeType={lowStock > 0 ? "negative" : "positive"}
        sparkline={lowStockSpark}
        sparklineTone="error"
        lastUpdated="Live"
        onClick={() => setKpiModal("lowStock")}
       />
      </div>
    </ContentCard>

    <ContentCard title="Recent Generated Reports">
     <div className="space-y-3 text-sm">
      {(
       [
        {
         name: `Orders ${rangeLabel()}`,
         format: "PDF",
         run: () => handleDownloadPDF("Orders Report"),
        },
        {
         name: `Inventory ${rangeLabel()}`,
         format: "CSV",
         run: () => handleDownloadCSV(inventoryInRange, "Inventory Report"),
        },
        {
         name: `Production ${rangeLabel()}`,
         format: "PDF",
         run: () => handleDownloadPDF("Production Report"),
        },
       ]
      ).map((r) => (
       <div
        key={r.name}
        className="flex items-center justify-between gap-3 p-3.5 bg-printflow-surface-container rounded-xl border border-printflow-outline-variant/30"
       >
        <span className="text-sm font-medium">
         {r.name} ({r.format})
        </span>
        <Button
         variant="ghost"
         size="sm"
         onClick={r.run}
         aria-label={`Download ${r.name}`}
        >
         <Download className="w-4 h-4" />
        </Button>
       </div>
      ))}
     </div>
    </ContentCard>

    <Modal
     isOpen={kpiModal !== null}
     onClose={() => setKpiModal(null)}
     title={kpiModal ? kpiMeta[kpiModal].title : ""}
     description={kpiModal ? kpiMeta[kpiModal].desc : undefined}
     icon={kpiModal ? kpiMeta[kpiModal].icon : undefined}
     size="lg"
     footer={
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
       <Button
        variant="secondary"
        onClick={() => setKpiModal(null)}
        className="flex-1 sm:flex-none"
       >
        Close
       </Button>
       {kpiModal && (
        <Button
         variant="primary"
         onClick={() => {
          if (kpiModal === "lowStock") {
           handleDownloadCSV(drillDown as InventoryItem[], "Low Stock Report");
          } else {
           handleDownloadPDF(kpiMeta[kpiModal].title);
          }
          setKpiModal(null);
         }}
         className="flex-1 sm:flex-none"
        >
         <Download className="w-4 h-4" />
         {kpiModal === "lowStock" ? "Export CSV" : "Download PDF"}
        </Button>
       )}
      </div>
     }
    >
      {drillDown.length === 0 ? (
       <div className="py-10 text-center">
        <EmptyState
         icon={<Inbox className="w-7 h-7" />}
         title="No data in this range"
         description="Try a wider range, or check back once orders come in."
        />
       </div>
      ) : kpiModal === "lowStock" ? (
       <DataTable
        columns={inventoryColumns as any}
        data={drillDown as InventoryItem[]}
        keyExtractor={(r) => r.material_variant_id}
        emptyMessage="No low stock items in range"
        pageSize={10}
       />
      ) : (
       <DataTable
        columns={orderColumns as any}
        data={drillDown as Order[]}
        keyExtractor={(r) => r.order_id}
        emptyMessage="No orders in range"
        pageSize={10}
       />
      )}
    </Modal>
   </div>
  </AdminLayout>
 );
}

function EmptyChart() {
 return (
  <div className="h-[260px] flex items-center justify-center">
   <EmptyState
    icon={<Inbox className="w-7 h-7" />}
    title="No data yet"
    description="This chart will populate once data lands."
   />
  </div>
 );
}

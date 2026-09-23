"use client";

import { useEffect, useMemo, useState } from "react";
import {
 Download,
 TrendingUp,
 ShoppingCart,
 CheckCircle,
 Clock,
 AlertTriangle,
 Check,
} from "lucide-react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout";
import {
 ContentCard,
 ChartCard,
 Button,
  KpiCard,
  CountUp,
  DataTable,
  StatusBadge,
  Modal,
  FeedErrorBanner,
  useToast,
} from "@/components/ui";
import { csvRow, downloadCsv } from "@/lib/csv";
import { subscribeOrders } from "@/lib/services/orders";
import { subscribeInventory } from "@/lib/services/inventory";
import { useFeedStatus } from "@/lib/useFeedStatus";
import {
  useSparkSeries,
  orderCreatedAtKey,
  inventoryCheckoutKey,
} from "@/lib/hooks/useSparkSeries";
import { getInventoryStatus } from "@/lib/derived";
import type { Order, InventoryItem } from "@/types";

const todayKey = () => {
 const t = new Date();
 return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

export default function AnalyticsPage() {
 const [active, setActive] = useState("7d");
 const [kpiModal, setKpiModal] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [ready, setReady] = useState(false);
  const [customFrom, setCustomFrom] = useState(() => {
   const d = new Date();
   d.setDate(d.getDate() - 13);
   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [customTo, setCustomTo] = useState(todayKey);
  const [customOn, setCustomOn] = useState(false);
  const toast = useToast();
  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  useEffect(() => {
    const unsubOrders = subscribeOrders(
      (rows) => {
        setOrders(rows);
        setReady(true);
      },
      (e) => {
        onFeedError(e);
        // Never leave the page on a skeleton: render the error state.
        setReady(true);
      },
    );
    const unsubInv = subscribeInventory(setInventory, onFeedError);
    return () => {
     unsubOrders();
     unsubInv();
    };
  }, [feedNonce, onFeedError]);

  // Bucketed series for the 4 KPI cards.
  const ordersSeries = useSparkSeries(orders, orderCreatedAtKey, 7);
  const completedSeries = useSparkSeries(
    orders.filter((o) => o.status === "Completed"),
    orderCreatedAtKey,
    7,
  );
  const pendingSeries = useSparkSeries(
    orders.filter((o) =>
      ["Pending", "In Production", "Ready for Pickup"].includes(o.status),
    ),
    orderCreatedAtKey,
    7,
  );
  const lowStockSeries = useSparkSeries(
    inventory.filter((i) => getInventoryStatus(i) !== "In Stock"),
    inventoryCheckoutKey,
    7,
  );

  const ranges = useMemo(
   () => [
    { id: "7d", label: "Last 7 Days" },
    { id: "30d", label: "Last 30 Days" },
    ...(customOn ? [{ id: "custom", label: "Custom" }] : []),
   ],
   [customOn],
  );

  // Day window behind the trend chart (and the CSV export): presets count
  // back from today; custom walks from-to (capped at 62 days).
  const windowDays = useMemo(() => {
   if (active === "custom") {
    const keys: string[] = [];
    const start = new Date(`${customFrom}T00:00:00`);
    const end = new Date(`${customTo}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    for (
     let d = new Date(start);
     d <= end && keys.length < 62;
     d.setDate(d.getDate() + 1)
    ) {
     keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
     );
    }
    return keys;
   }
   const days = active === "7d" ? 7 : 30;
   const now = new Date();
   const dayKeys: string[] = [];
   for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
   }
   return dayKeys;
  }, [active, customFrom, customTo]);

  const rangedOrders = useMemo(() => {
   const inWindow = new Set(windowDays);
   return orders.filter((o) => inWindow.has((o.created_at ?? "").slice(0, 10)));
  }, [orders, windowDays]);

  const applyCustom = () => {
   if (!customFrom || !customTo || customFrom > customTo) {
    toast.error("Invalid date range");
    return;
   }
   const span =
    Math.round(
     (new Date(`${customTo}T00:00:00`).getTime() -
      new Date(`${customFrom}T00:00:00`).getTime()) /
      86400000,
    ) + 1;
   if (span > 62) {
    toast.error("Custom range is capped at 62 days");
    return;
   }
   setCustomOn(true);
   setActive("custom");
   toast.success(`Custom range applied: ${customFrom} - ${customTo}`);
  };

  const handleExport = () => {
   if (rangedOrders.length === 0) return;
   const headers = [
    "order_id",
    "customer_name",
    "item_type",
    "quantity",
    "status",
    "priority",
    "target_date",
    "payment_amount",
    "payment_status",
   ];
   const lines = [
    headers.join(","),
    ...rangedOrders.map((o) =>
     csvRow([
      o.order_id,
      o.customer_name,
      o.item_type,
      o.quantity,
      o.status,
      o.priority,
      o.target_date,
      o.payment_amount,
      o.payment_status ?? "Unpaid",
     ]),
    ),
   ];
   downloadCsv(`analytics-${active}-${todayKey()}.csv`, lines);
   toast.success(`Exported ${rangedOrders.length} orders`);
  };

  const trendData = useMemo(() => {
   return windowDays.map((k) => {
      const day = orders.filter(
        (o) => (o.created_at ?? "").slice(0, 10) === k,
      );
      const completed = day.filter((o) => o.status === "Completed").length;
      return {
        name: new Date(k).toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        }),
        orders: day.length,
        completed,
        pending: day.length - completed,
       };
     });
   }, [orders, windowDays]);

  const onTimeVsOverdue = useMemo(() => {
    const completed = orders.filter((o) => o.status === "Completed").length;
    const overdue = orders.filter((o) => o.priority === "Overdue").length;
    return [
      { name: "On time", value: completed },
      { name: "Overdue", value: overdue },
    ];
  }, [orders]);

  const materialUsageTrends = useMemo(
    () =>
      inventory
        .map((i) => ({
          name: i.material_variant_id,
          usage: i.forecasted_demand_next_7_days,
        }))
        .slice(0, 8),
    [inventory],
  );

  const lowStockCount = useMemo(
    () =>
      inventory.filter((i) => getInventoryStatus(i) !== "In Stock").length,
    [inventory],
  );
  const staleCount = useMemo(
    () => inventory.filter((i) => i.isStale).length,
    [inventory],
  );

  // KPI drilldown datasets.
  const completedOrders = useMemo(
   () => orders.filter((o) => o.status === "Completed"),
   [orders],
  );
  const inFlightOrders = useMemo(
   () =>
    orders.filter((o) =>
     ["Pending", "In Production", "Ready for Pickup"].includes(o.status),
    ),
   [orders],
  );
  const lowStockItems = useMemo(
   () => inventory.filter((i) => getInventoryStatus(i) !== "In Stock"),
   [inventory],
  );

  // Compact modal columns (no eye/action column): 6-7 columns fit the
  // modal full-view with no bottom scrollbar.
  const orderModalCols = [
   {
    key: "order_id",
    header: "Order ID",
    render: (r: Order) => (
     <span className="font-mono text-xs">{r.order_id}</span>
    ),
   },
   { key: "customer_name", header: "Customer" },
   { key: "item_type", header: "Item Type" },
   {
    key: "quantity",
    header: "Qty",
    render: (r: Order) => r.quantity.toLocaleString(),
   },
   {
    key: "priority",
    header: "Priority",
    render: (r: Order) => (
     <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
       r.priority === "Overdue"
        ? "bg-printflow-error-container text-printflow-on-error-container"
        : r.priority === "Urgent"
        ? "bg-printflow-warning-container text-printflow-warning"
        : "bg-printflow-primary-fixed/20 text-printflow-primary"
      }`}
     >
      {r.priority}
     </span>
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
  ];

  const inventoryModalCols = [
   {
    key: "material_variant_id",
    header: "Variant ID",
    render: (r: InventoryItem) => (
     <span className="font-mono text-xs">{r.material_variant_id}</span>
    ),
   },
   { key: "item_type", header: "Item Type" },
   {
    key: "current_stock",
    header: "Stock",
    render: (r: InventoryItem) => `${r.current_stock}`,
   },
   {
    key: "reorder_point",
    header: "ROP",
    render: (r: InventoryItem) => (
     <span
      className={
       r.current_stock <= r.reorder_point
        ? "text-printflow-error font-bold"
        : ""
      }
     >
      {r.reorder_point}
     </span>
    ),
   },
   { key: "forecasted_demand_next_7_days", header: "Forecast 7d" },
   {
    key: "status",
    header: "Status",
    render: (r: InventoryItem) => (
     <span className="flex flex-wrap items-center gap-1 min-w-0">
      <StatusBadge
       status={r.status.toLowerCase().replace(/\s+/g, "-") as any}
       customLabel={r.status}
      />
      {r.isStale && (
       <span className="text-[10px] px-1 py-0.5 rounded bg-printflow-warning-container text-printflow-warning whitespace-nowrap">
        Delayed
       </span>
      )}
     </span>
    ),
   },
  ];
  const onTimePct = useMemo(() => {
    const done = orders.filter((o) => o.status === "Completed").length;
    const inFlight = orders.filter((o) =>
      ["Pending", "In Production", "Ready for Pickup"].includes(o.status),
    ).length;
    return done + inFlight > 0
      ? Math.round((done / (done + inFlight)) * 100)
      : 0;
  }, [orders]);

   return (
     <AdminLayout
       title="Analytics"
       subtitle="Insights on orders and materials"
     >
      {feedError && (
       <FeedErrorBanner
        message={feedError}
        showCached={orders.length > 0 || inventory.length > 0}
        onRetry={retryFeed}
       />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Orders"
          value={orders.length}
          icon="OrdersIcon"
          change="total"
          changeType="neutral"
          sparkline={ordersSeries}
          sparklineTone="primary"
          lastUpdated="7d"
          onClick={() => setKpiModal("orders")}
          loading={!ready}
        />
        <KpiCard
          label="Completed"
          value={orders.filter((o) => o.status === "Completed").length}
          icon="CheckIcon"
          change="closed"
          changeType="positive"
          trend="up"
          sparkline={completedSeries}
          sparklineTone="success"
          lastUpdated="7d"
          onClick={() => setKpiModal("completed")}
          loading={!ready}
        />
        <KpiCard
          label="In Flight"
          value={
            orders.filter(
              (o) =>
                o.status === "Pending" ||
                o.status === "In Production" ||
                o.status === "Ready for Pickup",
            ).length
          }
          icon="Clock"
          change="active"
          changeType="negative"
          trend="up"
          sparkline={pendingSeries}
          sparklineTone="warning"
          lastUpdated="7d"
          onClick={() => setKpiModal("inflight")}
          loading={!ready}
        />
        <KpiCard
          label="Need Reorder"
          value={lowStockCount}
          icon="AlertIcon"
          change="low + insufficient"
          changeType="negative"
          trend="up"
          sparkline={lowStockSeries}
          sparklineTone="error"
          lastUpdated="7d"
          onClick={() => setKpiModal("lowstock")}
          loading={!ready}
        />
      </div>

      <Modal isOpen={kpiModal==="orders"} onClose={()=>setKpiModal(null)} title="Orders" description={`${orders.length} orders - GET /api/orders`} icon={<ShoppingCart className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
        <DataTable columns={orderModalCols} data={orders} keyExtractor={r=>r.order_id} emptyMessage="No orders" pageSize={10} previewLimit={0} scrollable={false} />
      </Modal>
      <Modal isOpen={kpiModal==="completed"} onClose={()=>setKpiModal(null)} title="Completed" description={`${completedOrders.length} orders - GET /api/orders?status=Completed`} icon={<CheckCircle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
        <DataTable columns={orderModalCols} data={completedOrders} keyExtractor={r=>r.order_id} emptyMessage="No completed orders" pageSize={10} previewLimit={0} scrollable={false} />
      </Modal>
      <Modal isOpen={kpiModal==="inflight"} onClose={()=>setKpiModal(null)} title="In Flight" description={`${inFlightOrders.length} orders - Pending / In Production / Ready for Pickup`} icon={<Clock className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
        <DataTable columns={orderModalCols} data={inFlightOrders} keyExtractor={r=>r.order_id} emptyMessage="No in-flight orders" pageSize={10} previewLimit={0} scrollable={false} />
      </Modal>
      <Modal isOpen={kpiModal==="lowstock"} onClose={()=>setKpiModal(null)} title="Need Reorder" description={`${lowStockItems.length} variants below reorder point (low + insufficient)`} icon={<AlertTriangle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
        <DataTable columns={inventoryModalCols} data={lowStockItems} keyExtractor={r=>r.material_variant_id} emptyMessage="All stocked" pageSize={10} previewLimit={0} scrollable={false} />
      </Modal>

       <ContentCard className="mb-6">
         <div className="flex flex-wrap items-end gap-3">
           <div>
             <label className="block text-xs text-printflow-on-surface-variant mb-1">
               Period
             </label>
             <select
               value={active}
               onChange={(e) => setActive(e.target.value)}
               className="px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
             >
               {ranges.map((r) => (
                 <option key={r.id} value={r.id}>
                   {r.label}
                 </option>
               ))}
             </select>
           </div>
           <div>
             <label className="block text-xs text-printflow-on-surface-variant mb-1">
               From
             </label>
             <input
               type="date"
               value={customFrom}
               max={customTo}
               onChange={(e) => setCustomFrom(e.target.value)}
               aria-label="Custom range start"
               className="px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
             />
           </div>
           <div>
             <label className="block text-xs text-printflow-on-surface-variant mb-1">
               To
             </label>
             <input
               type="date"
               value={customTo}
               min={customFrom}
               onChange={(e) => setCustomTo(e.target.value)}
               aria-label="Custom range end"
               className="px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
             />
           </div>
           <Button variant="primary" onClick={applyCustom}>
             <Check className="w-4 h-4" />
             Apply
           </Button>
           <Button
             variant="secondary"
             onClick={handleExport}
             disabled={rangedOrders.length === 0}
           >
             <Download className="w-4 h-4" />
             Export
           </Button>
         </div>
       </ContentCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Order Volume Trends"
           subtitle={
             active === "custom"
               ? `Orders per day (descriptive) - ${customFrom} - ${customTo}`
               : `Orders per day (descriptive) - ${active === "7d" ? "Last 7 Days" : "Last 30 Days"}`
           }
          type="area"
          data={trendData}
          xKey="name"
          yKeys={["orders", "completed", "pending"]}
          colors={["var(--color-printflow-on-surface)", "var(--color-printflow-on-surface-variant)", "var(--color-printflow-outline)"]}
          height={320}
          loading={!ready}
        />
        <ChartCard
          title="On-time vs Overdue Completion Rates"
          subtitle="Target: Overdue flagged by priority"
          type="pie"
          data={onTimeVsOverdue}
          xKey="name"
          yKeys={["value"]}
          colors={["var(--color-printflow-on-surface)", "var(--color-printflow-on-surface-variant)"]}
          height={320}
          loading={!ready}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Material Usage"
          type="bar"
          data={materialUsageTrends}
          xKey="name"
          yKeys={["usage"]}
          colors={["var(--color-printflow-on-surface)"]}
          height={320}
          showLegend={false}
          loading={!ready}
        />
        <ContentCard
          title="Restock Forecast"
          subtitle="Preview - full details on Forecasting page"
          action={
            <Link href="/forecasting">
              <Button variant="secondary">
                <TrendingUp className="w-4 h-4" />
                View Forecasting
              </Button>
            </Link>
          }
        >
          <div className="space-y-2 text-sm">
            {materialUsageTrends.slice(0, 3).map((m) => (
              <p key={m.name}>
                <span className="font-semibold">{m.name}:</span>{" "}
                {m.usage >= 10 ? (
                  <span className="text-printflow-error">Needs reorder</span>
                ) : (
                  "In Stock"
                )}
              </p>
            ))}
          </div>
        </ContentCard>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <ContentCard title="On-time" className="text-center">
          <div className="text-3xl font-bold text-printflow-success">
            <CountUp value={`${onTimePct}%`} />
          </div>
          <p className="text-xs">On-time</p>
        </ContentCard>
        <ContentCard title="Pending" className="text-center">
          <div className="text-3xl font-bold">
            <CountUp
              value={trendData.reduce((a, b) => a + b.pending, 0)}
            />
          </div>
          <p className="text-xs">Pending</p>
        </ContentCard>
        <ContentCard title="Low Stock" className="text-center">
          <div className="text-3xl font-bold text-printflow-warning">
            <CountUp value={lowStockCount} />
          </div>
          <p className="text-xs">Materials</p>
        </ContentCard>
        <ContentCard title="Delayed Sync" className="text-center">
          <div className="text-3xl font-bold text-printflow-warning">
            <CountUp value={staleCount} />
          </div>
          <p className="text-xs">Needs sync</p>
        </ContentCard>
      </div>
    </AdminLayout>
  );
}

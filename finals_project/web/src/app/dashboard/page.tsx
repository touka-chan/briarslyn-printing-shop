"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  ShoppingCart,
  Factory,
  TrendingUp,
} from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
  KpiCard,
  ContentCard,
  FilterToolbar,
  DataTable,
  StatusBadge,
  ChartCard,
  Modal,
  Button,
  FeedErrorBanner,
} from "@/components/ui";
import { subscribeOrders } from "@/lib/services/orders";
import { subscribeInventory } from "@/lib/services/inventory";
import {
  useSparkSeries,
  orderCreatedAtKey,
  inventoryCheckoutKey,
} from "@/lib/hooks/useSparkSeries";
import { getInventoryStatus, priorityWeight } from "@/lib/derived";
import { useFeedStatus } from "@/lib/useFeedStatus";
import type { Order, InventoryItem, ProductionJob } from "@/types";

export default function DashboardPage() {
 const [activePriority, setActivePriority] = useState("All");
 const [activeStockFilter, setActiveStockFilter] = useState("All");
 const [searchValue, setSearchValue] = useState("");
 const [kpiModal, setKpiModal] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [ready, setReady] = useState(false);
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

 // Live sparkline series (last 7 days, local TZ).
 const ordersCreatedSeries = useSparkSeries(orders, orderCreatedAtKey, 7);
 const ordersCompletedSeries = useSparkSeries(
  orders.filter((o) => o.status === "Completed"),
  orderCreatedAtKey,
  7,
 );
 const ordersPendingSeries = useSparkSeries(
  orders.filter((o) =>
   ["Pending", "In Production", "Ready for Pickup"].includes(o.status),
  ),
  orderCreatedAtKey,
  7,
 );
  const checkoutSeries = useSparkSeries(inventory, inventoryCheckoutKey, 7);
  // Delayed-sync activity - real per-day checkout events for stale
  // variants (flat zero = no recent checkouts, not a placeholder).
  const staleItemsSeries = useSparkSeries(
   inventory.filter((i) => i.isStale),
   inventoryCheckoutKey,
   7,
  );
 const productionSeries = useSparkSeries(
  orders.filter((o) => o.status === "In Production"),
  orderCreatedAtKey,
  7,
 );

 const priorityTabs = useMemo(
  () => [
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
  ],
  [orders],
 );

 const stockTabs = useMemo(
  () => [
   { id: "All", label: "All", count: inventory.length },
   {
    id: "In Stock",
    label: "In Stock",
    count: inventory.filter((i) => getInventoryStatus(i) === "In Stock").length,
   },
   {
    id: "Low Stock",
    label: "Low Stock",
    count: inventory.filter((i) => getInventoryStatus(i) === "Low Stock").length,
   },
   {
    id: "Insufficient Stock",
    label: "Insufficient",
    count: inventory.filter((i) => getInventoryStatus(i) === "Insufficient Stock")
     .length,
   },
  ],
  [inventory],
 );

  // Header + table search boxes share one query that narrows both main
  // tables (KPIs and tab counts stay global).
  const matchesOrder = (o: Order, q: string) =>
   !q ||
   `${o.order_id} ${o.customer_name} ${o.item_type}`
    .toLowerCase()
    .includes(q);
  const matchesMaterial = (i: InventoryItem, q: string) =>
   !q ||
   `${i.material_variant_id} ${i.item_type}`
    .toLowerCase()
    .includes(q);

  const filteredByPriority = useMemo(() => {
   const q = searchValue.trim().toLowerCase();
   const base =
    activePriority === "All"
     ? orders
     : orders.filter((o) => o.priority === activePriority);
   return base
    .filter((o) => matchesOrder(o, q))
    .sort((a, b) =>
     activePriority === "All"
      ? priorityWeight(a.priority) - priorityWeight(b.priority) ||
        a.target_date.localeCompare(b.target_date)
      : a.target_date.localeCompare(b.target_date),
    );
  }, [orders, activePriority, searchValue]);

  const filteredInventory = useMemo(() => {
   const q = searchValue.trim().toLowerCase();
   const base =
    activeStockFilter === "All"
     ? inventory
     : inventory.filter((i) => getInventoryStatus(i) === activeStockFilter);
   return base.filter((i) => matchesMaterial(i, q));
  }, [inventory, activeStockFilter, searchValue]);

 const reorderAlerts = useMemo(
  () => inventory.filter((i) => i.current_stock <= i.reorder_point),
  [inventory],
 );
 const staleItems = useMemo(() => inventory.filter((i) => i.isStale), [inventory]);
 const overdueOrders = useMemo(
  () => orders.filter((o) => o.priority === "Overdue"),
  [orders],
 );
 const pendingOrders = useMemo(
  () =>
   orders.filter(
    (o) =>
     o.status === "Pending" ||
     o.status === "In Production" ||
     o.status === "Ready for Pickup",
   ),
  [orders],
 );
 const completedOrders = useMemo(
  () => orders.filter((o) => o.status === "Completed"),
  [orders],
 );
 const inProductionOrders = useMemo(
  () => orders.filter((o) => o.status === "In Production"),
  [orders],
 );

 const totalOrders = orders.length;
 const totalCompleted = completedOrders.length;
 const totalPending = pendingOrders.length;
 const totalLowStock = reorderAlerts.length;
 const productionQueue: ProductionJob[] = inProductionOrders.map((o) => ({
  id: o.id ?? o.order_id,
  order_id: o.order_id,
  item_type: o.item_type,
  status: o.status,
  priority: o.priority,
  target_date: o.target_date,
  estimated_completion: o.estimated_completion,
  based_on: o.based_on,
 }));

 // Sparkline-aware KPI cards (last 7 days).
 const orderColumns = [
  {
   key: "order_id",
   header: "Order ID",
   render: (r: Order) => <span className="font-mono text-xs">{r.order_id}</span>,
  },
  { key: "customer_name", header: "Customer" },
  { key: "item_type", header: "Item Type" },
  {
   key: "quantity",
   header: "Qty",
   render: (r: Order) => r.quantity.toLocaleString(),
  },
  {
   key: "target_date",
   header: "Target Date",
  },
  {
   key: "priority",
   header: "Priority",
   render: (r: Order) => (
    <span
     className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
  {
   key: "estimated_completion",
   header: "ETA",
   render: (r: Order) => (
    <div>
     <div className="font-medium text-xs">{r.estimated_completion}</div>
     <div className="text-[10px] text-printflow-on-surface-variant">
      {r.based_on?.join(", ")}
     </div>
    </div>
   ),
  },
 ];

 const inventoryColumns = [
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
   header: "Threshold (ROP)",
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
    <span className="flex items-center gap-2">
     <StatusBadge
      status={r.status.toLowerCase().replace(/\s+/g, "-") as any}
      customLabel={r.status}
     />
     {r.isStale && (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-printflow-warning-container text-printflow-warning">
       STALE
      </span>
     )}
    </span>
   ),
  },
 ];

 const productionColumns = [
  {
   key: "order_id",
   header: "Order ID",
   render: (r: ProductionJob) => (
    <span className="font-mono text-xs">{r.order_id}</span>
   ),
  },
  { key: "item_type", header: "Item Type" },
  {
   key: "priority",
   header: "Priority",
   render: (r: ProductionJob) => (
    <span
     className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
   render: (r: ProductionJob) => (
    <StatusBadge
     status={r.status.toLowerCase().replace(/\s+/g, "-") as any}
     customLabel={r.status}
    />
   ),
  },
  { key: "target_date", header: "Target Date" },
  { key: "estimated_completion", header: "ETA" },
 ];

 return (
  <AdminLayout
    title="Brialyns Art Sign Dashboard"
    subtitle="Overview of orders, production and inventory"
    onSearch={setSearchValue}
   >
    {feedError && (
     <FeedErrorBanner
      message={feedError}
      showCached={orders.length > 0 || inventory.length > 0}
      onRetry={retryFeed}
     />
    )}
    {/* Row 1: Key Metrics from dashboard summary */}
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
    <KpiCard
     label="Total Orders"
     value={totalOrders}
     icon="OrdersIcon"
     change="all orders"
     changeType="neutral"
     sparkline={ordersCreatedSeries}
     sparklineTone="primary"
     lastUpdated="7d"
     onClick={() => setKpiModal("total")}
     loading={!ready}
    />
    <KpiCard
     label="Pending"
     value={totalPending}
     icon="Clock"
     change={`${overdueOrders.length} overdue`}
     changeType="negative"
     trend="up"
     sparkline={ordersPendingSeries}
     sparklineTone="warning"
     lastUpdated="7d"
     onClick={() => setKpiModal("pending")}
     loading={!ready}
    />
    <KpiCard
     label="Completed"
     value={totalCompleted}
     icon="CheckIcon"
     change="on-time"
     changeType="positive"
     trend="up"
     sparkline={ordersCompletedSeries}
     sparklineTone="success"
     lastUpdated="7d"
     onClick={() => setKpiModal("completed")}
     loading={!ready}
    />
    <KpiCard
     label="Low Stock Items"
     value={totalLowStock}
     icon="AlertIcon"
     change={`${reorderAlerts.length} need reorder`}
     changeType="negative"
     trend="up"
     sparkline={checkoutSeries}
     sparklineTone="error"
     lastUpdated="7d"
     onClick={() => setKpiModal("lowStock")}
     loading={!ready}
    />
   </div>

   {/* Row 2: Additional metrics */}
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
    <KpiCard
     label="On-time"
     value={`${
      totalCompleted + pendingOrders.length > 0
       ? Math.round(
          (totalCompleted / (totalCompleted + pendingOrders.length)) * 100,
         )
       : 0
     }%`}
     icon="CheckIcon"
     change="on-time rate"
     changeType="positive"
     trend="up"
     sparkline={ordersCompletedSeries}
     sparklineTone="success"
     lastUpdated="7d"
     onClick={() => setKpiModal("onTime")}
     loading={!ready}
    />
    <KpiCard
     label="In Production"
     value={inProductionOrders.length}
     icon="Clock"
     change="in queue"
     changeType="negative"
     trend="up"
     sparkline={productionSeries}
     sparklineTone="warning"
     lastUpdated="7d"
     onClick={() => setKpiModal("productionPending")}
     loading={!ready}
    />
    <KpiCard
     label="Low Stock"
     value={reorderAlerts.length}
     icon="AlertIcon"
     change="materials"
     changeType="negative"
     trend="up"
     sparkline={checkoutSeries}
     sparklineTone="error"
     lastUpdated="7d"
     onClick={() => setKpiModal("lowStock")}
     loading={!ready}
    />
    <KpiCard
     label="Delayed Sync"
     value={staleItems.length}
     icon="AlertIcon"
     change="needs sync"
     changeType="negative"
     trend="up"
      sparkline={staleItemsSeries}
     sparklineTone="warning"
     lastUpdated="7d"
     onClick={() => setKpiModal("delayed")}
     loading={!ready}
    />
   </div>

   {/* KPI Modals - unified users master style */}
   <Modal
    isOpen={kpiModal === "total"}
    onClose={() => setKpiModal(null)}
    title="Total Orders"
    description={`${totalOrders} orders - GET /api/orders`}
    icon={<ShoppingCart className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
    <div className="space-y-4">
      <DataTable
       columns={orderColumns}
       data={orders}
       keyExtractor={(r) => r.order_id}
       emptyMessage="No orders"
       pageSize={10}
      />
    </div>
   </Modal>

   <Modal
    isOpen={kpiModal === "pending"}
    onClose={() => setKpiModal(null)}
    title="Pending"
    description={`${pendingOrders.length} orders - GET /api/orders/queue`}
    icon={<Clock className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
     <DataTable
      columns={orderColumns}
      data={pendingOrders}
      keyExtractor={(r) => r.order_id}
      emptyMessage="No pending orders"
      pageSize={10}
     />
   </Modal>

   <Modal
    isOpen={kpiModal === "completed"}
    onClose={() => setKpiModal(null)}
    title="Completed"
    description={`${completedOrders.length} orders - GET /api/orders?status=Completed`}
    icon={<CheckCircle className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
     <DataTable
      columns={orderColumns}
      data={completedOrders}
      keyExtractor={(r) => r.order_id}
      emptyMessage="No completed orders"
      pageSize={10}
     />
   </Modal>

   <Modal
    isOpen={kpiModal === "lowStock"}
    onClose={() => setKpiModal(null)}
    title="Low Stock"
    description={`${reorderAlerts.length} materials - stock <= ROP`}
    icon={<AlertTriangle className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
     <DataTable
      columns={inventoryColumns}
      data={reorderAlerts}
      keyExtractor={(r) => r.material_variant_id}
      emptyMessage="All stocked"
      pageSize={10}
     />
   </Modal>

   <Modal
    isOpen={kpiModal === "onTime"}
    onClose={() => setKpiModal(null)}
    title={`On time ${
     totalCompleted + pendingOrders.length > 0
      ? Math.round(
         (totalCompleted / (totalCompleted + pendingOrders.length)) * 100,
        )
      : 0
    }%`}
    description="GET /api/orders - on time vs overdue"
    icon={<TrendingUp className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
    <div className="space-y-4">
     <div className="grid grid-cols-3 gap-3">
      <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 text-center">
       <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
        ON TIME
       </p>
       <p className="text-xl font-bold text-printflow-success mt-1">
        {totalCompleted + pendingOrders.length > 0
         ? Math.round(
            (totalCompleted / (totalCompleted + pendingOrders.length)) * 100,
           )
         : 0}
        %
       </p>
      </div>
      <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 text-center">
       <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
        OVERDUE
       </p>
       <p className="text-xl font-bold text-printflow-error mt-1">
        {overdueOrders.length}
       </p>
      </div>
      <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 text-center">
       <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
        PENDING
       </p>
       <p className="text-xl font-bold mt-1">{pendingOrders.length}</p>
      </div>
     </div>
      <DataTable
       columns={orderColumns}
       data={overdueOrders}
       keyExtractor={(r) => r.order_id}
       emptyMessage="No overdue orders"
       pageSize={10}
      />
    </div>
   </Modal>

   <Modal
    isOpen={kpiModal === "productionPending"}
    onClose={() => setKpiModal(null)}
    title="Pending Production"
    description={`${productionQueue.length} jobs - priority Overdue/Urgent/Upcoming`}
    icon={<Factory className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
     <DataTable
      columns={productionColumns}
      data={productionQueue}
      keyExtractor={(r) => r.order_id}
      emptyMessage="No jobs"
      pageSize={10}
     />
   </Modal>

   <Modal
    isOpen={kpiModal === "delayed"}
    onClose={() => setKpiModal(null)}
    title="Delayed Sync"
    description={`${staleItems.length} needs sync - ESP32 isStale`}
    icon={<AlertTriangle className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
    {staleItems.length > 0 ? (
      <DataTable
       columns={inventoryColumns}
       data={staleItems}
       keyExtractor={(r) => r.material_variant_id}
       emptyMessage="All synced"
       pageSize={10}
      />
    ) : (
     <p className="text-sm text-printflow-on-surface-variant">
      All materials synced
     </p>
    )}
   </Modal>

   {/* Live chart data derived from real orders */}
   {(() => {
    const dayKeys: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
     const d = new Date(now);
     d.setDate(d.getDate() - i);
     dayKeys.push(d.toISOString().slice(0, 10));
    }
    const ordersTrend = dayKeys.map((k) => {
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
    const onTimeVsOverdue = [
     { name: "On time", value: completedOrders.length },
     { name: "Overdue", value: overdueOrders.length },
    ];
    const materialUsageTrends = inventory
     .map((i) => ({
      name: i.material_variant_id,
      usage: i.forecasted_demand_next_7_days,
     }))
     .slice(0, 8);
    const productionByPriority = [
     {
      name: "Overdue",
      value: orders.filter((o) => o.priority === "Overdue").length,
     },
     {
      name: "Urgent",
      value: orders.filter((o) => o.priority === "Urgent").length,
     },
     {
      name: "Upcoming",
      value: orders.filter((o) => o.priority === "Upcoming").length,
     },
    ];

    return (
     <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
       <ChartCard
        title="Order Volume Trends"
        type="area"
        data={ordersTrend}
        xKey="name"
        yKeys={["orders", "completed", "pending"]}
        colors={["var(--color-printflow-on-surface)", "var(--color-printflow-on-surface-variant)", "var(--color-printflow-outline)"]}
        height={280}
        loading={!ready}
       />
       <ChartCard
        title="On-time vs Overdue"
        type="pie"
        data={onTimeVsOverdue}
        xKey="name"
        yKeys={["value"]}
        colors={["var(--color-printflow-on-surface)", "var(--color-printflow-on-surface-variant)"]}
        height={280}
        loading={!ready}
       />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
       <ChartCard
        title="Material Usage"
        type="bar"
        data={materialUsageTrends}
        xKey="name"
        yKeys={["usage"]}
        colors={["var(--color-printflow-on-surface)"]}
        height={260}
        showLegend={false}
        loading={!ready}
       />
       <ChartCard
        title="Production by Priority"
        type="bar"
        data={productionByPriority}
        xKey="name"
        yKeys={["value"]}
        colors={["var(--color-printflow-on-surface)"]}
        height={260}
        showLegend={false}
        loading={!ready}
       />
      </div>
     </>
    );
   })()}

   <div className="space-y-8">
    <ContentCard
     title="Production Queue"
     subtitle={`${filteredByPriority.length} orders`}
     className="min-w-0 overflow-hidden w-full"
    >
     <div className="space-y-5">
      <FilterToolbar
       tabs={priorityTabs}
       activeTab={activePriority}
       onTabChange={setActivePriority}
       searchPlaceholder="Search order or customer"
       onSearchChange={setSearchValue}
       searchValue={searchValue}
      />
      <div className="overflow-x-auto -mx-6 px-6">
        <DataTable
         columns={orderColumns}
         data={filteredByPriority}
         keyExtractor={(r) => r.order_id}
         emptyMessage="No orders"
         pageSize={25}
         loading={!ready}
        />
      </div>
     </div>
    </ContentCard>

    <ContentCard
     title="Inventory"
     subtitle={`${filteredInventory.length} materials`}
     className="min-w-0 overflow-hidden w-full"
    >
     <div className="space-y-5">
       <FilterToolbar
        tabs={stockTabs}
        activeTab={activeStockFilter}
        onTabChange={setActiveStockFilter}
        searchPlaceholder="Search material"
        onSearchChange={setSearchValue}
        searchValue={searchValue}
       />
      <div className="overflow-x-auto -mx-6 px-6">
        <DataTable
         columns={inventoryColumns}
         data={filteredInventory}
         keyExtractor={(r) => r.material_variant_id}
         emptyMessage="No materials"
         pageSize={25}
         loading={!ready}
        />
      </div>
     </div>
    </ContentCard>
    <ContentCard
     title="Production Schedule"
     subtitle={`${productionQueue.length} active jobs`}
     className="min-w-0 overflow-hidden w-full"
    >
     <div className="overflow-x-auto -mx-6 px-6 py-3">
        <DataTable
         columns={productionColumns}
         data={productionQueue}
         keyExtractor={(r) => r.order_id}
         emptyMessage="No jobs"
         pageSize={25}
         loading={!ready}
        />
     </div>
    </ContentCard>
   </div>
  </AdminLayout>
 );
}

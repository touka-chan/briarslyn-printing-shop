"use client";

import { useState, useMemo } from "react";
import { Download, FileText, Factory, Package, Check, ShoppingCart, Clock, AlertTriangle } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, FilterToolbar, Button, ChartCard, KpiCard, useToast, Modal, DataTable, StatusBadge, PriorityBadge, PaymentBadge } from "@/components/ui";
import { toPaymentStatus } from "@/components/ui/PaymentBadge";
import { chartData, mockInventory, mockOrders, sparklineData, kpiUpdatedLabel } from "@/lib/mockData";
import { Order, InventoryItem } from "@/types";

const timeRanges = [
 { id: "week", label: "This Week" },
 { id: "month", label: "This Month" },
 { id: "quarter", label: "This Quarter" },
];

export default function ReportsPage() {
 const [activeRange, setActiveRange] = useState("month");
 const [customFrom, setCustomFrom] = useState("2026-08-01");
 const [customTo, setCustomTo] = useState("2026-08-20");
 const toast = useToast();

 const lowStock = mockInventory.filter((i) => i.status !== "In Stock").length;
 const pending = mockOrders.filter((o) => o.status === "Pending").length;
 const completed = mockOrders.filter((o) => o.status === "Completed").length;
 const inProduction = mockOrders.filter(
  (o) => o.status === "In Production" || o.status === "Ready for Pickup",
 ).length;

 const productionSummary = useMemo(
  () => [
   { name: "Pending", value: pending },
   { name: "In Production", value: inProduction },
   { name: "Completed", value: completed },
  ],
  [pending, inProduction, completed],
 );

 const handleDownload = (label: string, format: "PDF" | "CSV") => {
  toast.success(`Generating ${label} (${format}) — download will start shortly`);
 };

 const handleCustomRangeApply = () => {
  if (!customFrom || !customTo || customFrom > customTo) {
   toast.error("Invalid date range");
   return;
  }
  toast.success(`Custom range applied: ${customFrom} → ${customTo}`);
 };

 // --- Drill-down modal ----------------------------------------------------
 // Click a Key Metrics card → modal opens with a filtered list of the rows
 // that contribute to that number. Filter is composed with the active time
 // range so the modal and the headline value stay in sync.
 const [kpiModal, setKpiModal] = useState<null | "total" | "pending" | "completed" | "lowStock">(null);

 // Map each KPI to the subset of mock data it represents, filtered by the
 // active time range (week / month / quarter). In a real backend this becomes
 // a server-side query — the shape stays the same.
 const rangeFilter = (iso: string) => {
  const d = new Date(iso);
  if (activeRange === "week") {
   return d >= new Date("2026-08-14");
  }
  if (activeRange === "month") {
   return d >= new Date("2026-07-20");
  }
  // quarter
  return d >= new Date("2026-05-20");
 };

 const ordersInRange = useMemo(
  () => mockOrders.filter((o) => rangeFilter(o.target_date)),
  [activeRange],
 );
 const inventoryInRange = useMemo(
  () => mockInventory.filter((i) => rangeFilter("2026-08-20")),
  [activeRange],
 );

 const drillDown = useMemo(() => {
  if (kpiModal === "total") return ordersInRange;
  if (kpiModal === "pending")
   return ordersInRange.filter((o) => o.status === "Pending");
  if (kpiModal === "completed")
   return ordersInRange.filter((o) => o.status === "Completed");
  if (kpiModal === "lowStock")
   return inventoryInRange.filter((i) => i.status !== "In Stock");
  return [] as (Order | InventoryItem)[];
 }, [kpiModal, ordersInRange, inventoryInRange]);

 const orderColumns: { key: keyof Order | "view"; header: string; render?: (r: Order) => React.ReactNode }[] = [
  { key: "order_id", header: "Order", render: (r) => <span className="type-mono">{r.order_id}</span> },
  { key: "customer_name", header: "Customer" },
  { key: "item_type", header: "Item" },
  { key: "quantity", header: "Qty", render: (r) => r.quantity.toLocaleString() },
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
   render: (r) => (
    <PaymentBadge
     status={toPaymentStatus(r.payment_status)}
    />
   ),
  },
 ];

 const inventoryColumns = [
  { key: "material_variant_id", header: "Variant", render: (r: InventoryItem) => <span className="type-mono">{r.material_variant_id}</span> },
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
     status={r.status.toLowerCase().replace(/\s+/g, "-") as any}
     customLabel={r.status}
    />
   ),
  },
 ];

 const kpiMeta: Record<NonNullable<typeof kpiModal>, { title: string; desc: string; icon: React.ReactNode; count: number }> = {
  total: {
   title: "Total Orders",
   desc: `${drillDown.length} orders in selected range`,
   icon: <ShoppingCart className="w-5 h-5" />,
   count: drillDown.length,
  },
  pending: {
   title: "Pending Orders",
   desc: `${drillDown.length} orders awaiting production`,
   icon: <Clock className="w-5 h-5" />,
   count: drillDown.length,
  },
  completed: {
   title: "Completed Orders",
   desc: `${drillDown.length} orders fulfilled in range`,
   icon: <Check className="w-5 h-5" />,
   count: drillDown.length,
  },
  lowStock: {
   title: "Low Stock Items",
   desc: `${drillDown.length} materials below reorder point`,
   icon: <AlertTriangle className="w-5 h-5" />,
   count: drillDown.length,
  },
 };

 return (
  <AdminLayout
   title="Reports"
   subtitle="Generate and download operational reports"
  >
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
         onClick={() => handleDownload("Orders Report", "PDF")}
        >
         <FileText className="w-4 h-4" />
         Orders
        </Button>
        <Button
         variant="primary"
         onClick={() => handleDownload("Inventory Report", "CSV")}
        >
         <Package className="w-4 h-4" />
         Inventory
        </Button>
        <Button
         variant="primary"
         onClick={() => handleDownload("Production Report", "PDF")}
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
       <ChartCard
        title=""
        type="bar"
        data={chartData.productionByPriority}
        xKey="name"
        yKeys={["value"]}
        colors={["#00535b"]}
        height={260}
        showLegend={false}
       />
      </div>
      <Button
       variant="secondary"
       className="mt-6 w-full"
       onClick={() => handleDownload("Orders PDF", "PDF")}
      >
       <Download className="w-4 h-4" />
       Download Orders PDF
      </Button>
     </ContentCard>
     <ContentCard
      title="Stock by Status"
      subtitle="Current inventory status"
      className="min-w-0 overflow-hidden"
     >
      <div className="pt-3">
       <ChartCard
        title=""
        type="pie"
        data={chartData.inventoryByStatus}
        xKey="name"
        yKeys={["value"]}
        height={260}
       />
      </div>
      <Button
       variant="secondary"
       className="mt-6 w-full"
       onClick={() => handleDownload("Inventory CSV", "CSV")}
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
       <ChartCard
        title=""
        type="pie"
        data={productionSummary}
        xKey="name"
        yKeys={["value"]}
        colors={["#ed6c02", "#00535b", "#2e7d32"]}
        height={260}
       />
      </div>
      <Button
       variant="secondary"
       className="mt-6 w-full"
       onClick={() => handleDownload("Production PDF", "PDF")}
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
       value={mockOrders.length}
       icon="ShoppingCart"
       sparkline={sparklineData(mockOrders.length, "rising", "rep-total")}
       sparklineTone="primary"
       lastUpdated={kpiUpdatedLabel("rep-total")}
       onClick={() => setKpiModal("total")}
      />
      <KpiCard
       label="Pending"
       value={pending}
       icon="Clock"
       sparkline={sparklineData(pending, "wave", "rep-pending")}
       sparklineTone="warning"
       lastUpdated={kpiUpdatedLabel("rep-pending")}
       onClick={() => setKpiModal("pending")}
      />
      <KpiCard
       label="Completed"
       value={completed}
       icon="Check"
       sparkline={sparklineData(completed, "rising", "rep-completed")}
       sparklineTone="success"
       lastUpdated={kpiUpdatedLabel("rep-completed")}
       onClick={() => setKpiModal("completed")}
      />
      <KpiCard
       label="Low Stock Items"
       value={lowStock}
       icon="AlertTriangle"
       change={lowStock > 0 ? "needs attention" : "all stocked"}
       changeType={lowStock > 0 ? "negative" : "positive"}
       sparkline={sparklineData(lowStock, "spike", "rep-lowstock")}
       sparklineTone="error"
       lastUpdated={kpiUpdatedLabel("rep-lowstock")}
       onClick={() => setKpiModal("lowStock")}
      />
     </div>
    </ContentCard>

    <ContentCard title="Recent Generated Reports">
     <div className="space-y-3 text-sm">
      {[
       { name: "Orders 2026-08-01 to 2026-08-14", type: "Orders", format: "PDF" },
       { name: "Inventory 2026-08-01 to 2026-08-14", type: "Inventory", format: "CSV" },
       { name: "Production 2026-08-01 to 2026-08-14", type: "Production", format: "PDF" },
      ].map((r) => (
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
         onClick={() => toast.success(`Downloading ${r.name}`)}
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
          handleDownload(kpiMeta[kpiModal].title, "PDF");
          setKpiModal(null);
         }}
         className="flex-1 sm:flex-none"
        >
         <Download className="w-4 h-4" />
         Download as PDF
        </Button>
       )}
      </div>
     }
    >
     {kpiModal === "lowStock" ? (
      <DataTable
       columns={inventoryColumns as any}
       data={drillDown as InventoryItem[]}
       keyExtractor={(r) => r.material_variant_id}
       emptyMessage="No low stock items in range"
      />
     ) : (
      <DataTable
       columns={orderColumns as any}
       data={drillDown as Order[]}
       keyExtractor={(r) => r.order_id}
       emptyMessage="No orders in range"
      />
     )}
    </Modal>
   </div>
  </AdminLayout>
 );
}

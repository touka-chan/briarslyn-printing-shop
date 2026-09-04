"use client";

import { useState, useMemo } from "react";
import {
 Eye,
 Download,
 Package,
 AlertTriangle,
 Calendar,
} from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
 ContentCard,
 FilterToolbar,
 DataTable,
 StatusBadge,
 Button,
 Modal,
 KpiCard,
 ChartCard,
 useToast,
} from "@/components/ui";
import { mockInventory, chartData, sparklineData, kpiUpdatedLabel } from "@/lib/mockData";
import { InventoryItem } from "@/types";

const dateRanges = [
 { id: "7d", label: "Last 7 Days" },
 { id: "30d", label: "Last 30 Days" },
 { id: "custom", label: "Custom Range" },
] as const;

type DateRangeId = (typeof dateRanges)[number]["id"];

export default function InventoryPage() {
 const [active, setActive] = useState("All");
 const [search, setSearch] = useState("");
 const [sel, setSel] = useState<InventoryItem | null>(null);
 const [open, setOpen] = useState(false);
 const [kpiModal, setKpiModal] = useState<string | null>(null);
 const [dateRange, setDateRange] = useState<DateRangeId>("7d");
 const [customFrom, setCustomFrom] = useState("2026-08-01");
 const [customTo, setCustomTo] = useState("2026-08-20");
 const toast = useToast();

 const tabs = [
  { id: "All", label: "All", count: mockInventory.length },
  {
   id: "In Stock",
   label: "In Stock",
   count: mockInventory.filter((i) => i.status === "In Stock").length,
  },
  {
   id: "Low Stock",
   label: "Low Stock",
   count: mockInventory.filter((i) => i.status === "Low Stock").length,
  },
  {
   id: "Insufficient Stock",
   label: "Insufficient",
   count: mockInventory.filter((i) => i.status === "Insufficient Stock").length,
  },
 ];

 const filtered =
  active === "All"
   ? mockInventory
   : mockInventory.filter((i) => i.status === active);
 const searched = filtered.filter(
  (i) =>
   !search ||
   `${i.material_variant_id} ${i.item_type}`
    .toLowerCase()
    .includes(search.toLowerCase()),
 );
 const alerts = mockInventory.filter(
  (i) => i.current_stock <= i.reorder_point,
 );
 const stale = mockInventory.filter((i) => i.isStale);
 const lowStock = mockInventory.filter((i) => i.status === "Low Stock");
 const insufficient = mockInventory.filter(
  (i) => i.status === "Insufficient Stock",
 );

 // Date range: drives the Order Volume Trends chart + the chart subtitle.
 // For 7d/30d we re-sample the 7-day mock series; for custom we keep the 7d
 // series but the caption updates to reflect the custom span.
 const orderTrendData = useMemo(() => {
  if (dateRange === "30d") {
   // Re-scale the daily series to 30 days by tripling each value with a
   // mild variance so the chart looks meaningfully different from 7d.
   return chartData.ordersTrend.flatMap((d) => [
    d,
    { ...d, name: `${d.name}+10d`, orders: d.orders + 1, completed: d.completed },
    { ...d, name: `${d.name}+20d`, orders: Math.max(1, d.orders - 1), completed: Math.max(0, d.completed - 1) },
   ]);
  }
  return chartData.ordersTrend;
 }, [dateRange]);

 const dateRangeLabel = useMemo(() => {
  if (dateRange === "7d") return "Last 7 Days";
  if (dateRange === "30d") return "Last 30 Days";
  return `${customFrom} → ${customTo}`;
 }, [dateRange, customFrom, customTo]);

 const handleAcknowledge = (item: InventoryItem) => {
  toast.info(`Stale sync acknowledged for ${item.material_variant_id}`);
 };
 const handleCreatePO = (item: InventoryItem) => {
  toast.success(
   `Purchase order queued for ${item.item_type} (${item.reorder_point * 2} units)`,
  );
 };

 const exportCSV = () => {
  const headers = [
   "material_variant_id",
   "item_type",
   "category",
   "current_stock",
   "reorder_point",
   "threshold",
   "forecast_7d",
   "status",
  ];
  const lines = [
   headers.join(","),
   ...searched.map((r) =>
    [
     r.material_variant_id,
     `"${r.item_type}"`,
     r.category,
     r.current_stock,
     r.reorder_point,
     r.threshold,
     r.forecasted_demand_next_7_days,
     r.status,
    ].join(","),
   ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${searched.length} material${searched.length === 1 ? "" : "s"}`);
 };

 const cols = [
  {
   key: "material_variant_id",
   header: "Variant ID",
   render: (r: InventoryItem) => (
    <span className="type-mono">{r.material_variant_id}</span>
   ),
  },
  { key: "item_type", header: "Item Type" },
  {
   key: "tag_uid",
   header: "Tag UID",
   render: (r: InventoryItem) => (
    <span className="type-mono">{r.tag_uid}</span>
   ),
  },
  {
   key: "sensor_id",
   header: "Sensor (IoT)",
   render: (r: InventoryItem) => (
    <span className="flex items-center gap-1.5 type-mono text-printflow-on-surface-variant">
     {r.sensor_id || "ESP32-01"}
     <span
      className={`inline-block w-2 h-2 rounded-full ${
       r.isStale
        ? "bg-printflow-warning"
        : "bg-printflow-success animate-pulse"
      }`}
      title={r.isStale ? "Sync delayed (>12h)" : "Active connection"}
     />
    </span>
   ),
  },
  {
   key: "current_stock",
   header: "Stock",
   render: (r: InventoryItem) =>
    `${r.current_stock} / thr ${r.threshold}`,
  },
  {
   key: "reorder_point",
   header: "ROP (dynamic)",
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
   key: "model",
   header: "Model",
   render: (r: InventoryItem) => <span className="text-xs">{r.model}</span>,
  },
  {
   key: "status",
   header: "Status",
   render: (r: InventoryItem) => (
    <span className="flex items-center gap-1">
     <StatusBadge
      status={r.status.toLowerCase().replace(/\s+/g, "-") as any}
      customLabel={r.status}
     />
     {r.isStale && (
      <button
       onClick={(e) => {
        e.stopPropagation();
        handleAcknowledge(r);
       }}
       title="Acknowledge stale RFID sync"
       className="text-[10px] px-1 py-0.5 rounded bg-printflow-warning-container text-printflow-warning hover:opacity-80"
      >
       STALE
      </button>
     )}
    </span>
   ),
  },
  {
   key: "actions",
   header: "",
   render: (r: InventoryItem) => (
    <button
     onClick={(e) => {
      e.stopPropagation();
      setSel(r);
      setOpen(true);
     }}
     className="text-printflow-on-surface-variant hover:text-printflow-primary transition-colors"
     aria-label={`View ${r.material_variant_id}`}
    >
     <Eye className="w-4 h-4" />
    </button>
   ),
  },
 ];

 return (
  <AdminLayout
   title="Inventory"
   subtitle="Track materials and stock levels"
   onSearch={setSearch}
  >
   {/* Row 1: KPI cards — matches Dashboard's `gap-4 md:gap-6 mb-6` rhythm */}
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
    <KpiCard
     label="Total Variants"
     value={mockInventory.length}
     icon="Package"
     sparkline={sparklineData(mockInventory.length, "stable", "inv-total")}
     sparklineTone="primary"
     lastUpdated={kpiUpdatedLabel("inv-total")}
     onClick={() => setKpiModal("total")}
    />
    <KpiCard
     label="Low Stock"
     value={lowStock.length}
     icon="AlertTriangle"
     change="needs attention"
     changeType="negative"
     trend="up"
     sparkline={sparklineData(lowStock.length, "rising", "inv-lowstock")}
     sparklineTone="warning"
     lastUpdated={kpiUpdatedLabel("inv-lowstock")}
     onClick={() => setKpiModal("low")}
    />
    <KpiCard
     label="Insufficient"
     value={insufficient.length}
     icon="AlertTriangle"
     change="urgent"
     changeType="negative"
     trend="up"
     sparkline={sparklineData(insufficient.length, "spike", "inv-insufficient")}
     sparklineTone="error"
     lastUpdated={kpiUpdatedLabel("inv-insufficient")}
     onClick={() => setKpiModal("insufficient")}
    />
    <KpiCard
     label="Need Reorder"
     value={alerts.length}
     icon="AlertTriangle"
     change={`${stale.length} delayed`}
     changeType={stale.length ? "negative" : "positive"}
     trend="up"
     sparkline={sparklineData(alerts.length, "rising", "inv-reorder")}
     sparklineTone="error"
     lastUpdated={kpiUpdatedLabel("inv-reorder")}
     onClick={() => setKpiModal("reorder")}
    />
   </div>

   {/* Date Range Filter — segmented control with proper gaps, smooth toggle */}
   <div className="mb-10 lg:mb-12">
    <ContentCard className="min-w-0">
     <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-8">
       <div className="flex items-center gap-3 text-printflow-on-surface-variant pr-4 border-r border-printflow-outline-variant/40">
        <Calendar className="w-4 h-4" />
        <span className="text-[11px] font-semibold tracking-widest uppercase">
         Date Range
        </span>
       </div>
       <div
        role="tablist"
        aria-label="Date range"
        className="inline-flex p-2 bg-printflow-surface-container rounded-xl border border-printflow-outline-variant/40 gap-2"
       >
        {dateRanges.map((r) => {
         const isActive = dateRange === r.id;
         return (
          <button
           key={r.id}
           role="tab"
           aria-selected={isActive}
           onClick={() => setDateRange(r.id)}
           className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
            isActive
             ? "bg-printflow-primary text-printflow-on-primary shadow-sm"
             : "text-printflow-on-surface-variant hover:text-printflow-on-surface hover:bg-printflow-surface"
           }`}
          >
           {r.label}
          </button>
         );
        })}
       </div>
      </div>
      {dateRange === "custom" && (
       <div className="flex flex-wrap items-end gap-3 pt-1 pl-1 border-t border-printflow-outline-variant/30">
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
        <p className="text-[11px] text-printflow-on-surface-variant ml-1">
          Applies to the Order Volume Trends chart below.
        </p>
       </div>
      )}
     </div>
    </ContentCard>
   </div>

   {/* Row 2: Charts — explicitly wider gaps and roomier inner padding.
       The wrapping `p-1` on each cell adds a visible breathing band AROUND
       the chart cards so they sit clearly apart from each other and from the
       date-range card above. */}
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 mb-10 lg:mb-12">
    <div className="bg-transparent p-1">
     <ChartCard
      title="Order Volume Trends"
      subtitle={`Orders per day • ${dateRangeLabel}`}
      type="area"
      data={orderTrendData}
      xKey="name"
      yKeys={["orders", "completed", "pending"]}
      colors={["#00535b", "#2e7d32", "#ed6c02"]}
      height={340}
     />
    </div>
    <div className="bg-transparent p-1">
     <div className="chart-card flex flex-col">
      <div className="mb-8">
       <h3 className="text-lg font-semibold text-printflow-on-surface">
        On-time vs Overdue
       </h3>
       <p className="text-sm text-printflow-on-surface-variant mt-2">
        Completion rate across active orders
       </p>
      </div>
      <div className="flex-1" style={{ minHeight: 240 }}>
       <ChartCard
        title=""
        subtitle=""
        type="pie"
        data={chartData.onTimeVsOverdue}
        xKey="name"
        yKeys={["value"]}
        colors={["#2e7d32", "#ba1a1a"]}
        height={240}
       />
      </div>
      <div className="mt-8 pt-6 border-t border-printflow-outline-variant/40 grid grid-cols-3 gap-8">
       <div className="flex items-start gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-[#2e7d32] mt-1.5 shrink-0" />
        <div className="min-w-0">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant leading-none">
          ON-TIME
         </p>
         <p className="text-base font-bold mt-2">
          {chartData.onTimeVsOverdue.find((d) => d.name === "On-time")?.value ?? 0}
         </p>
        </div>
       </div>
       <div className="flex items-start gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a] mt-1.5 shrink-0" />
        <div className="min-w-0">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant leading-none">
          OVERDUE
         </p>
         <p className="text-base font-bold mt-2">
          {chartData.onTimeVsOverdue.find((d) => d.name === "Overdue")?.value ?? 0}
         </p>
        </div>
       </div>
       <div className="flex items-start gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-printflow-outline-variant mt-1.5 shrink-0" />
        <div className="min-w-0">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant leading-none">
          TARGET
         </p>
         <p className="text-[11px] text-printflow-on-surface-variant mt-2 leading-snug">
          Overdue flagged by priority
         </p>
        </div>
       </div>
      </div>
     </div>
    </div>
   </div>

   <Modal
    isOpen={kpiModal === "total"}
    onClose={() => setKpiModal(null)}
    title="Total Variants"
    description={`${mockInventory.length} variants • GET /api/inventory`}
    icon={<Package className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
    <DataTable
     columns={cols}
     data={mockInventory}
     keyExtractor={(r) => r.material_variant_id}
     emptyMessage="No materials"
    />
   </Modal>
   <Modal
    isOpen={kpiModal === "low"}
    onClose={() => setKpiModal(null)}
    title="Low Stock"
    description={`${lowStock.length} items • GET /api/inventory?status=Low Stock`}
    icon={<AlertTriangle className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
    <DataTable
     columns={cols}
     data={lowStock}
     keyExtractor={(r) => r.material_variant_id}
     emptyMessage="No low stock"
    />
   </Modal>
   <Modal
    isOpen={kpiModal === "insufficient"}
    onClose={() => setKpiModal(null)}
    title="Insufficient Stock"
    description={`${insufficient.length} items • GET /api/inventory?status=Insufficient`}
    icon={<AlertTriangle className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
    <DataTable
     columns={cols}
     data={insufficient}
     keyExtractor={(r) => r.material_variant_id}
     emptyMessage="No insufficient stock"
    />
   </Modal>
   <Modal
    isOpen={kpiModal === "reorder"}
    onClose={() => setKpiModal(null)}
    title="Need Reorder"
    description={`${alerts.length} items • stock ≤ ROP`}
    icon={<AlertTriangle className="w-5 h-5" />}
    size="lg"
    footer={
     <Button variant="secondary" onClick={() => setKpiModal(null)}>
      Close
     </Button>
    }
   >
    <DataTable
     columns={cols}
     data={alerts}
     keyExtractor={(r) => r.material_variant_id}
     emptyMessage="No reorder needed"
    />
   </Modal>

   {/* Tables — explicit `space-y-6 lg:space-y-8` between Materials and Reorder Alerts
       matches the Dashboard's tables section rhythm. */}
   <div className="space-y-6 lg:space-y-8">
    <ContentCard
     title="Materials"
     subtitle={`${searched.length} materials`}
     className="min-w-0 overflow-hidden w-full"
    >
     <div className="space-y-5">
      <FilterToolbar
       tabs={tabs}
       activeTab={active}
       onTabChange={setActive}
       searchPlaceholder="Search material"
       onSearchChange={setSearch}
       searchValue={search}
       customActions={
        <Button variant="secondary" onClick={exportCSV}>
         <Download className="w-4 h-4" />
         Export
        </Button>
       }
      />
      <div className="overflow-x-auto -mx-6 px-6">
       <DataTable
        columns={cols}
        data={searched}
        keyExtractor={(r) => r.material_variant_id}
        onRowClick={(r) => {
         setSel(r);
         setOpen(true);
        }}
        emptyMessage="No materials"
       />
      </div>
     </div>
    </ContentCard>

    <ContentCard
     title="Reorder Alerts"
     subtitle={
      alerts.length > 0
       ? `${alerts.length} items need attention • stock ≤ ROP`
       : undefined
     }
     className="min-w-0 overflow-hidden w-full"
    >
    {alerts.length === 0 ? (
     <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-printflow-success-container flex items-center justify-center mb-3">
       <Package className="w-5 h-5 text-printflow-success" />
      </div>
      <p className="text-sm font-medium text-printflow-on-surface">
       All stocked
      </p>
      <p className="text-xs text-printflow-on-surface-variant">
       No materials below reorder point
      </p>
     </div>
    ) : (
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {alerts.map((item) => {
       const pct = Math.min(
        100,
        Math.round(
         (item.current_stock / Math.max(item.reorder_point, 1)) * 100,
        ),
       );
       const isInsufficient = item.status === "Insufficient Stock";
       return (
        <div
         key={item.material_variant_id}
         onClick={() => {
          setSel(item);
          setOpen(true);
         }}
         className="group flex flex-col gap-3 p-4 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 hover:border-printflow-outline-variant hover:shadow-sm hover:bg-printflow-surface-container/30 cursor-pointer transition-all"
        >
         <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3 min-w-0">
           <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
             isInsufficient
              ? "bg-printflow-error-container text-printflow-error"
              : "bg-printflow-warning-container text-printflow-warning"
            }`}
           >
            <AlertTriangle className="w-4 h-4" />
           </div>
           <div className="min-w-0">
            <p className="type-mono text-[13px] font-semibold text-printflow-on-surface leading-none tracking-tight">
             {item.material_variant_id}
            </p>
            <p className="text-[13px] font-medium text-printflow-on-surface leading-tight truncate">
             {item.item_type}
            </p>
            <p className="text-[11px] text-printflow-on-surface-variant">
             {item.category} • {item.tag_uid}
            </p>
           </div>
          </div>
          <StatusBadge
           status={item.status.toLowerCase().replace(/\s+/g, "-") as any}
           customLabel={item.status}
          />
         </div>

         <div className="grid grid-cols-3 gap-2">
          <div className="bg-printflow-surface-container rounded-lg px-3 py-2.5">
           <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant leading-none">
            STOCK
           </p>
           <p className="text-sm font-bold text-printflow-on-surface leading-tight mt-1">
            {item.current_stock}
            <span className="font-normal text-printflow-on-surface-variant text-xs">
             {" "}
             / {item.threshold}
            </span>
           </p>
          </div>
          <div className="bg-printflow-surface-container rounded-lg px-3 py-2.5">
           <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant leading-none">
            ROP
           </p>
           <p className="text-sm font-bold text-printflow-on-surface leading-tight mt-1">
            {item.reorder_point}
           </p>
           <p className="text-[10px] text-printflow-on-surface-variant leading-none">
            {item.model}
           </p>
          </div>
          <div className="bg-printflow-surface-container rounded-lg px-3 py-2.5">
           <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant leading-none">
            FORECAST 7D
           </p>
           <p className="text-sm font-bold text-printflow-on-surface leading-tight mt-1">
            {item.forecasted_demand_next_7_days}
           </p>
          </div>
         </div>

         <div className="h-1.5 bg-printflow-surface-container rounded-full overflow-hidden">
          <div
           className="h-full rounded-full transition-all"
           style={{
            width: `${pct}%`,
            background: isInsufficient ? "#ba1a1a" : "#ed6c02",
           }}
          />
         </div>
         <div className="flex items-center justify-between -mt-1">
          <p className="text-[11px] text-printflow-on-surface-variant">
           {pct}% of ROP •{" "}
           {isInsufficient ? "needs urgent reorder" : "below reorder point"}
          </p>
          <Button
           variant="ghost"
           size="sm"
           onClick={(e) => {
            e.stopPropagation();
            handleCreatePO(item);
           }}
          >
           Create PO
          </Button>
         </div>
        </div>
       );
      })}
     </div>
    )}
   </ContentCard>
   </div>

   <Modal
    isOpen={open}
    onClose={() => {
     setOpen(false);
     setSel(null);
    }}
    title={sel ? `Variant ${sel.material_variant_id}` : "Variant"}
    description={sel ? `${sel.item_type} • ${sel.category}` : undefined}
    icon={<Package className="w-5 h-5" />}
    size="lg"
    footer={
     <div className="flex gap-2">
      {sel && (
       <Button
        variant="primary"
        onClick={() => {
         handleCreatePO(sel);
         setOpen(false);
        }}
       >
        Create Reorder
       </Button>
      )}
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
         VARIANT ID
        </p>
        <p className="type-mono font-bold">{sel.material_variant_id}</p>
       </div>
       <StatusBadge
        status={sel.status.toLowerCase().replace(/\s+/g, "-") as any}
        customLabel={sel.status}
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
         CATEGORY
        </p>
        <p className="text-sm font-medium mt-1">{sel.category}</p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
         CURRENT STOCK
        </p>
        <p className="text-sm font-bold mt-1">
         {sel.current_stock}{" "}
         <span className="font-normal text-xs">/ thr {sel.threshold}</span>
        </p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
         REORDER POINT
        </p>
        <p className="text-sm font-bold mt-1">
         {sel.reorder_point}{" "}
         <span className="text-xs font-normal text-printflow-on-surface-variant">
          ({sel.model})
         </span>
        </p>
       </div>
       <div className="p-3.5 bg-printflow-primary/5 rounded-xl border border-printflow-primary/20">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
         FORECAST 7D
        </p>
        <p className="text-sm font-bold text-printflow-primary mt-1">
         {sel.forecasted_demand_next_7_days}
        </p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">
         TAG / SENSOR
        </p>
        <p className="type-mono text-xs mt-1">
         {sel.tag_uid} • {sel.sensor_id}
        </p>
       </div>
      </div>
     </div>
    )}
   </Modal>
  </AdminLayout>
 );
}

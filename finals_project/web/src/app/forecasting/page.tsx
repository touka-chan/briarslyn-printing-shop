"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, AlertTriangle, TrendingUp, Package } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, FilterToolbar, DataTable, ChartCard, Button, KpiCard, Modal, StatusBadge } from "@/components/ui";
import { subscribeInventory } from "@/lib/services/inventory";
import {
  useSparkSeries,
  inventoryCheckoutKey,
} from "@/lib/hooks/useSparkSeries";
import { getInventoryStatus } from "@/lib/derived";
import { InventoryItem } from "@/types";

export default function ForecastingPage() {
 const [active, setActive] = useState("All");
 const [search, setSearch] = useState("");
 const [showSource, setShowSource] = useState(false);
 const [kpiModal, setKpiModal] = useState<string | null>(null);
 const [inventory, setInventory] = useState<InventoryItem[]>([]);

 useEffect(() => {
  const unsub = subscribeInventory(setInventory);
  return () => unsub();
 }, []);

 // Live sparkline series — checkout history per day for the last 7 days.
 const reorderSeries = useSparkSeries(
  inventory.filter((i) => i.current_stock <= i.reorder_point),
  inventoryCheckoutKey,
  7,
 );
 const insufficientSeries = useSparkSeries(
  inventory.filter((i) => getInventoryStatus(i) === "Insufficient Stock"),
  inventoryCheckoutKey,
  7,
 );
 // Model coverage (count over time) — flatten to current size per day so the
 // sparkline shows variant coverage instead of bucketed events.
 const holtWintersSeries = inventory.filter((i) => i.model === "Holt-Winters")
  .length
  ? [1, 1, 1, 1, 1, 1, 1]
  : [0, 0, 0, 0, 0, 0, 0];
 const forecastDemandTotal = useMemo(
  () =>
   inventory.reduce(
    (sum, i) => sum + (i.forecasted_demand_next_7_days ?? 0),
    0,
   ),
  [inventory],
 );
 const forecast7dSeries = useSparkSeries(inventory, inventoryCheckoutKey, 7);

 const tabs = useMemo(
  () => [
   { id: "All", label: "All", count: inventory.length },
   {
    id: "Tarpaulin",
    label: "Tarpaulin",
    count: inventory.filter((i) => i.category === "Tarpaulin").length,
   },
   {
    id: "Ink",
    label: "Ink",
    count: inventory.filter((i) => i.category === "Ink").length,
   },
   {
    id: "Paper",
    label: "Paper",
    count: inventory.filter((i) => i.category === "Paper").length,
   },
   {
    id: "Mug",
    label: "Mug",
    count: inventory.filter((i) => i.category === "Mug").length,
   },
   {
    id: "Shirt",
    label: "Shirt",
    count: inventory.filter((i) => i.category === "Shirt").length,
   },
  ],
  [inventory],
 );

 const filtered = useMemo(
  () =>
   active === "All"
    ? inventory
    : inventory.filter((i) => i.category === active),
  [inventory, active],
 );
 const searched = useMemo(
  () =>
   filtered.filter(
    (i) =>
     !search ||
     `${i.material_variant_id} ${i.item_type}`
      .toLowerCase()
      .includes(search.toLowerCase()),
   ),
  [filtered, search],
 );
 const atRisk = useMemo(
  () => inventory.filter((i) => i.current_stock <= i.reorder_point),
  [inventory],
 );
 const critical = useMemo(
  () => inventory.filter((i) => getInventoryStatus(i) === "Insufficient Stock"),
  [inventory],
 );
 const holtWinters = useMemo(
  () => inventory.filter((i) => i.model === "Holt-Winters"),
  [inventory],
 );
 const expSmooth = useMemo(
  () => inventory.filter((i) => i.model === "Exponential Smoothing"),
  [inventory],
 );

 const cols = [
  { key: "material_variant_id", header: "Variant ID", render: (r:InventoryItem)=><span className="font-mono text-xs">{r.material_variant_id}</span> },
  { key: "item_type", header: "Item Type" },
  { key: "current_stock", header: "Stock" },
  { key: "reorder_point", header: "ROP (Holt-Winters/Exp Smoothing)", render: (r:InventoryItem)=><span className={r.current_stock<=r.reorder_point?"text-printflow-error font-bold":""}>{r.reorder_point} ({r.model})</span> },
  { key: "forecasted_demand_next_7_days", header: "Forecast 7d" },
  { key: "tag_uid", header: "Tag UID", render: (r:InventoryItem)=><span className="font-mono text-xs">{r.tag_uid}</span> },
  { key: "sensor_id", header: "Sensor" },
 ];

 const statusCols = [
  { key: "material_variant_id", header: "Variant ID", render: (r:InventoryItem)=><span className="font-mono text-xs">{r.material_variant_id}</span> },
  { key: "item_type", header: "Item Type" },
  { key: "current_stock", header: "Stock" },
  { key: "reorder_point", header: "ROP" },
  { key: "status", header: "Status", render: (r:InventoryItem)=><StatusBadge status={r.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={r.status} /> },
 ];

  return (
   <AdminLayout title="Forecasting" subtitle="Inventory forecasts and reorder planning" headerActions={<Button variant="secondary"><Download className="w-4 h-4" />Export</Button>} onSearch={setSearch}>
    <div className="grid grid-cols-4 gap-4 mb-6">
     <KpiCard
      label="Need Reorder"
      value={atRisk.length}
      icon="AlertTriangle"
      change="below reorder point"
      changeType="negative"
      trend="up"
      sparkline={reorderSeries}
      sparklineTone="error"
      lastUpdated="7d"
      onClick={() => setKpiModal("reorder")}
     />
     <KpiCard
      label="Insufficient Stock"
      value={critical.length}
      icon="AlertTriangle"
      change="urgent"
      changeType="negative"
      trend="up"
      sparkline={insufficientSeries}
      sparklineTone="error"
      lastUpdated="7d"
      onClick={() => setKpiModal("insufficient")}
     />
     <KpiCard
      label="Forecast Model"
      value="Holt-Winters"
      icon="TrendingUp"
      change="time series model"
      changeType="neutral"
      trend="stable"
      sparkline={holtWintersSeries}
      sparklineTone="primary"
      lastUpdated="7d"
      onClick={() => setKpiModal("model")}
     />
     <KpiCard
      label="Forecast"
      value={forecastDemandTotal.toLocaleString()}
      icon="TrendingUp"
      change="next 7 days demand"
      changeType="neutral"
      trend="stable"
      sparkline={forecast7dSeries}
      sparklineTone="primary"
      lastUpdated="7d"
      onClick={() => setKpiModal("forecast")}
     />
    </div>

    <Modal isOpen={kpiModal==="reorder"} onClose={()=>setKpiModal(null)} title="Need Reorder" description={`${atRisk.length} items • stock ≤ ROP`} icon={<AlertTriangle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <DataTable columns={statusCols} data={atRisk} keyExtractor={r=>r.material_variant_id} emptyMessage="No reorder needed" />
    </Modal>
    <Modal isOpen={kpiModal==="insufficient"} onClose={()=>setKpiModal(null)} title="Insufficient Stock" description={`${critical.length} items • GET /api/inventory`} icon={<AlertTriangle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <DataTable columns={statusCols} data={critical} keyExtractor={r=>r.material_variant_id} emptyMessage="None" />
    </Modal>
    <Modal isOpen={kpiModal==="model"} onClose={()=>setKpiModal(null)} title="Forecast Model" description="Holt-Winters • GET /api/inventory/forecast" icon={<TrendingUp className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">HOLT WINTERS</p><p className="text-sm font-semibold mt-1">{holtWinters.length} variants</p><p className="text-xs text-printflow-on-surface-variant mt-1 truncate">{holtWinters.map(i=>i.material_variant_id).join(", ")}</p></div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">EXPONENTIAL SMOOTHING</p><p className="text-sm font-semibold mt-1">{expSmooth.length} variants</p><p className="text-xs text-printflow-on-surface-variant mt-1 truncate">{expSmooth.map(i=>i.material_variant_id).join(", ")}</p></div>
      </div>
      <DataTable columns={cols} data={inventory} keyExtractor={r=>r.material_variant_id} emptyMessage="No data" />
     </div>
    </Modal>
    <Modal isOpen={kpiModal==="forecast"} onClose={()=>setKpiModal(null)} title="Forecast 7 Days" description="GET /api/inventory/forecast?days=7" icon={<Package className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <DataTable columns={cols} data={inventory} keyExtractor={r=>r.material_variant_id} emptyMessage="No forecast" />
    </Modal>

   <div className="mb-6">
    <ChartCard title="Forecast vs Reorder Point" type="bar" data={inventory.map(i=>({name:i.material_variant_id, stock:i.current_stock, rop:i.reorder_point, forecast:i.forecasted_demand_next_7_days}))} xKey="name" yKeys={["stock","rop","forecast"]} colors={["#00535b","#ed6c02","#ba1a1a"]} height={340} />
    <div className="mt-3">
     <button onClick={()=>setShowSource(!showSource)} className="text-xs px-3 py-1.5 rounded-full border border-printflow-outline-variant bg-printflow-surface hover:bg-printflow-surface-container">
      {showSource ? "Collapse to Details ▼" : "Collapse to Details ▶"}
     </button>
    </div>
    {showSource && (
     <div className="mt-3 p-4 bg-printflow-surface-container rounded-lg border border-printflow-outline-variant text-sm space-y-2">
      <p className="font-semibold">RFID Checkout Source (POST /api/rfid/checkout)</p>
      <p className="font-mono text-xs bg-printflow-surface p-2 rounded border">Each tap = {"{material_variant_id, tag_uid, sensor_id: ESP32-01, timestamp}"} → -1 unit, debounce prevents duplicate.</p>
      <ul className="text-xs text-printflow-on-surface-variant list-disc pl-4 space-y-1">
       <li>One tag per variant (TARP-MED, INK-BLACK, etc.), whole-unit only.</li>
       <li>Offline cached syncs when ESP32 reconnects.</li>
       <li>Example: TARP-MED → stock 2 • ROP 4 → reorder alert</li>
      </ul>
     </div>
    )}
   </div>

   <div className="mb-6 p-5 bg-gradient-to-br from-printflow-surface to-printflow-surface-container rounded-xl border-2 border-printflow-primary/30 shadow-sm">
    <div className="flex items-start gap-3 mb-4">
     <div className="p-2 bg-printflow-primary/10 rounded-lg">
      <TrendingUp className="w-5 h-5 text-printflow-primary" />
     </div>
     <div>
      <h3 className="text-base font-semibold text-printflow-on-surface">Holt-Winters Predictive Analytics Parameters</h3>
      <p className="text-xs text-printflow-on-surface-variant mt-0.5">Additive Triple Exponential Smoothing Model Configuration</p>
     </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
     <div className="p-3 bg-printflow-surface rounded-lg border border-printflow-outline-variant/50">
      <p className="text-[10px] font-medium tracking-wide text-printflow-on-surface-variant uppercase">Model Name</p>
      <p className="text-sm font-semibold mt-1.5 text-printflow-on-surface">Holt-Winters</p>
      <p className="text-xs text-printflow-on-surface-variant mt-0.5">Triple Exponential Smoothing</p>
     </div>
     <div className="p-3 bg-printflow-surface rounded-lg border border-printflow-outline-variant/50">
      <p className="text-[10px] font-medium tracking-wide text-printflow-on-surface-variant uppercase">Alpha (Level)</p>
      <p className="text-sm font-semibold mt-1.5 text-printflow-primary">0.20</p>
      <p className="text-xs text-printflow-on-surface-variant mt-0.5">Base level smoothing</p>
     </div>
     <div className="p-3 bg-printflow-surface rounded-lg border border-printflow-outline-variant/50">
      <p className="text-[10px] font-medium tracking-wide text-printflow-on-surface-variant uppercase">Beta (Trend)</p>
      <p className="text-sm font-semibold mt-1.5 text-printflow-primary">0.15</p>
      <p className="text-xs text-printflow-on-surface-variant mt-0.5">Trend component weight</p>
     </div>
     <div className="p-3 bg-printflow-surface rounded-lg border border-printflow-outline-variant/50">
      <p className="text-[10px] font-medium tracking-wide text-printflow-on-surface-variant uppercase">Gamma (Seasonality)</p>
      <p className="text-sm font-semibold mt-1.5 text-printflow-primary">0.05</p>
      <p className="text-xs text-printflow-on-surface-variant mt-0.5">Seasonal pattern weight</p>
     </div>
     <div className="p-3 bg-printflow-surface rounded-lg border border-printflow-outline-variant/50 sm:col-span-2">
      <p className="text-[10px] font-medium tracking-wide text-printflow-on-surface-variant uppercase">Seasonality Period (L)</p>
      <p className="text-sm font-semibold mt-1.5 text-printflow-primary">7 intervals</p>
      <p className="text-xs text-printflow-on-surface-variant mt-0.5">Daily seasonal pattern (weekly cycle)</p>
     </div>
    </div>
   </div>

   <ContentCard title="Demand Forecast" subtitle={`${searched.length} materials`}>
    <FilterToolbar tabs={tabs} activeTab={active} onTabChange={setActive} searchPlaceholder="Search material" onSearchChange={setSearch} searchValue={search} />
    <DataTable columns={cols} data={searched} keyExtractor={r=>r.material_variant_id} emptyMessage="No forecast" />
   </ContentCard>
  </AdminLayout>
 );
}

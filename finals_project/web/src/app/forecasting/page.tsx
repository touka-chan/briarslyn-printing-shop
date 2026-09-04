"use client";

import { useState } from "react";
import { Download, AlertTriangle, TrendingUp, Package, ShoppingCart, ChevronRight, ChevronDown } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
 ContentCard,
 FilterToolbar,
 DataTable,
 ChartCard,
 Button,
 KpiCard,
 Modal,
 StatusBadge,
 PriorityBadge,
 useToast,
} from "@/components/ui";
import { mockInventory, sparklineData, kpiUpdatedLabel } from "@/lib/mockData";
import { InventoryItem } from "@/types";

export default function ForecastingPage() {
 const [active, setActive] = useState("All");
 const [search, setSearch] = useState("");
 const [showSource, setShowSource] = useState(false);
 const [kpiModal, setKpiModal] = useState<string | null>(null);
 const [sel, setSel] = useState<InventoryItem | null>(null);
 const [open, setOpen] = useState(false);
 const toast = useToast();

 const tabs = [
  { id: "All", label: "All", count: mockInventory.length },
  { id: "Tarpaulin", label: "Tarpaulin", count: mockInventory.filter(i=>i.category==="Tarpaulin").length },
  { id: "Ink", label: "Ink", count: mockInventory.filter(i=>i.category==="Ink").length },
  { id: "Paper", label: "Paper", count: mockInventory.filter(i=>i.category==="Paper").length },
  { id: "Mug", label: "Mug", count: mockInventory.filter(i=>i.category==="Mug").length },
  { id: "Shirt", label: "Shirt", count: mockInventory.filter(i=>i.category==="Shirt").length },
 ];

 const filtered = active==="All" ? mockInventory : mockInventory.filter(i=>i.category===active);
 const searched = filtered.filter(i=> !search || `${i.material_variant_id} ${i.item_type}`.toLowerCase().includes(search.toLowerCase()));
 const atRisk = mockInventory.filter(i=> i.current_stock <= i.reorder_point);
 const critical = mockInventory.filter(i=> i.status==="Insufficient Stock");
 const holtWinters = mockInventory.filter(i=> i.model==="Holt-Winters");
 const expSmooth = mockInventory.filter(i=> i.model==="Exponential Smoothing");

 // Suggested reorder quantity: cover forecast + 100% buffer, restore to 2x ROP at minimum
 const suggestedQty = (i: InventoryItem) =>
  Math.max(Math.max(i.forecasted_demand_next_7_days * 2, i.reorder_point * 2) - i.current_stock, 0);

 const handleCreatePO = (item: InventoryItem) => {
  const qty = suggestedQty(item);
  toast.success(
   `Purchase order queued for ${item.item_type} (${qty} units)`,
  );
 };

 const exportCSV = () => {
  const headers = [
   "material_variant_id",
   "item_type",
   "current_stock",
   "reorder_point",
   "forecast_7d",
   "suggested_reorder",
   "model",
  ];
  const lines = [
   headers.join(","),
   ...searched.map((r) =>
    [
     r.material_variant_id,
     `"${r.item_type}"`,
     r.current_stock,
     r.reorder_point,
     r.forecasted_demand_next_7_days,
     suggestedQty(r),
     r.model,
    ].join(","),
   ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `forecast-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${searched.length} forecast${searched.length === 1 ? "" : "s"}`);
 };

 const cols = [
  { key: "material_variant_id", header: "Variant ID", render: (r:InventoryItem)=><span className="type-mono">{r.material_variant_id}</span> },
  { key: "item_type", header: "Item Type" },
  { key: "current_stock", header: "Stock" },
  { key: "reorder_point", header: "ROP", render: (r:InventoryItem)=><span className={r.current_stock<=r.reorder_point?"text-printflow-error font-bold":""}>{r.reorder_point}</span> },
  { key: "forecasted_demand_next_7_days", header: "Forecast 7d", render: (r:InventoryItem)=><span className="font-semibold text-printflow-primary">{r.forecasted_demand_next_7_days}</span> },
  { key: "suggested_reorder", header: "Suggested Order", render: (r:InventoryItem)=> {
   const qty = suggestedQty(r);
   return qty > 0 ? <span className="font-semibold">{qty}</span> : <span className="text-printflow-on-surface-variant">—</span>;
  } },
  { key: "model", header: "Model", render: (r:InventoryItem)=> <span className="text-xs">{r.model}</span> },
  { key: "status", header: "Status", render: (r:InventoryItem)=> <StatusBadge status={r.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={r.status} /> },
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
     <ChevronRight className="w-4 h-4" />
    </button>
   ),
  },
 ];

 const statusCols = [
  { key: "material_variant_id", header: "Variant ID", render: (r:InventoryItem)=><span className="type-mono">{r.material_variant_id}</span> },
  { key: "item_type", header: "Item Type" },
  { key: "current_stock", header: "Stock" },
  { key: "reorder_point", header: "ROP" },
  { key: "status", header: "Status", render: (r:InventoryItem)=><StatusBadge status={r.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={r.status} /> },
 ];

 return (
  <AdminLayout title="Forecasting" subtitle="Inventory forecasts and reorder planning" headerActions={<Button variant="secondary" onClick={exportCSV}><Download className="w-4 h-4" />Export</Button>} onSearch={setSearch}>
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <KpiCard label="Need Reorder" value={atRisk.length} icon="AlertTriangle" change="below reorder point" changeType="negative" trend="up" sparkline={sparklineData(atRisk.length, "spike", "fc-reorder")} sparklineTone="error" lastUpdated={kpiUpdatedLabel("fc-reorder")} onClick={()=>setKpiModal("reorder")} />
    <KpiCard label="Insufficient Stock" value={critical.length} icon="AlertTriangle" change="urgent" changeType="negative" trend="up" sparkline={sparklineData(critical.length, "spike", "fc-insufficient")} sparklineTone="error" lastUpdated={kpiUpdatedLabel("fc-insufficient")} onClick={()=>setKpiModal("insufficient")} />
    <KpiCard label="Forecast Model" value="Holt-Winters" icon="TrendingUp" change="time series model" changeType="neutral" trend="stable" sparkline={sparklineData(80, "stable", "fc-model")} sparklineTone="primary" lastUpdated={kpiUpdatedLabel("fc-model")} onClick={()=>setKpiModal("model")} />
    <KpiCard label="Forecast" value="7 days" icon="TrendingUp" change="next 7 days demand" changeType="neutral" trend="stable" sparkline={sparklineData(45, "wave", "fc-window")} sparklineTone="primary" lastUpdated={kpiUpdatedLabel("fc-window")} onClick={()=>setKpiModal("forecast")} />
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
     <DataTable columns={cols} data={mockInventory} keyExtractor={r=>r.material_variant_id} emptyMessage="No data" />
    </div>
   </Modal>
   <Modal isOpen={kpiModal==="forecast"} onClose={()=>setKpiModal(null)} title="Forecast 7 Days" description="GET /api/inventory/forecast?days=7" icon={<Package className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
    <DataTable columns={cols} data={mockInventory} keyExtractor={r=>r.material_variant_id} emptyMessage="No forecast" />
   </Modal>

   <div className="mb-6">
    <ChartCard title="Forecast vs Reorder Point" type="bar" data={mockInventory.map(i=>({name:i.material_variant_id, stock:i.current_stock, rop:i.reorder_point, forecast:i.forecasted_demand_next_7_days}))} xKey="name" yKeys={["stock","rop","forecast"]} colors={["#00535b","#ed6c02","#ba1a1a"]} height={340} />
    <div className="mt-3">
     <button onClick={()=>setShowSource(!showSource)} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-printflow-outline-variant bg-printflow-surface hover:bg-printflow-surface-container transition-colors">
      {showSource ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      RFID checkout data source
     </button>
    </div>
    {showSource && (
     <div className="mt-3 p-4 bg-printflow-surface-container rounded-lg border border-printflow-outline-variant text-sm space-y-2">
      <p className="font-semibold">RFID Checkout Source (POST /api/rfid/checkout)</p>
      <p className="type-mono text-xs bg-printflow-surface p-2 rounded border">Each tap = {"{material_variant_id, tag_uid, sensor_id: ESP32-01, timestamp}"} → -1 unit, debounce prevents duplicate.</p>
      <ul className="text-xs text-printflow-on-surface-variant list-disc pl-4 space-y-1">
       <li>One tag per variant (TARP-MED, INK-BLACK, etc.), whole-unit only.</li>
       <li>Offline cached syncs when ESP32 reconnects.</li>
       <li>Example: TARP-MED → stock 2 • ROP 4 → reorder alert</li>
      </ul>
     </div>
    )}
   </div>

   <div className="mb-6 p-5 bg-gradient-to-br from-printflow-surface to-printflow-surface-container rounded-xl border-2 border-printflow-primary/30 shadow-1">
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
    <DataTable columns={cols} data={searched} keyExtractor={r=>r.material_variant_id} onRowClick={(r)=>{ setSel(r); setOpen(true); }} emptyMessage="No forecast" />
   </ContentCard>

   <Modal
    isOpen={open}
    onClose={() => { setOpen(false); setSel(null); }}
    title={sel ? `Forecast ${sel.material_variant_id}` : "Forecast"}
    description={sel ? `${sel.item_type} • ${sel.model}` : undefined}
    icon={<TrendingUp className="w-5 h-5" />}
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
        <ShoppingCart className="w-4 h-4" />
        Create PO ({suggestedQty(sel)})
       </Button>
      )}
      <Button
       variant="secondary"
       onClick={() => { setOpen(false); setSel(null); }}
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
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">VARIANT</p>
        <p className="type-mono font-bold">{sel.material_variant_id}</p>
        <p className="text-xs text-printflow-on-surface-variant mt-0.5">{sel.item_type} • {sel.category}</p>
       </div>
       <StatusBadge
        status={sel.status.toLowerCase().replace(/\s+/g,'-') as any}
        customLabel={sel.status}
       />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">CURRENT STOCK</p>
        <p className="text-xl font-bold mt-1">{sel.current_stock}</p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">REORDER POINT</p>
        <p className="text-xl font-bold mt-1">{sel.reorder_point}</p>
        <p className="text-[10px] text-printflow-on-surface-variant mt-0.5">{sel.model}</p>
       </div>
       <div className="p-3.5 bg-printflow-primary/5 rounded-xl border border-printflow-primary/20">
        <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">FORECAST 7D</p>
        <p className="text-xl font-bold text-printflow-primary mt-1">{sel.forecasted_demand_next_7_days}</p>
       </div>
      </div>
      <div className="p-4 bg-printflow-warning-container/20 border border-printflow-warning-container/40 rounded-xl">
       <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant uppercase">Suggested Reorder Quantity</p>
       <p className="text-3xl font-bold text-printflow-on-surface mt-1">{suggestedQty(sel)}</p>
       <p className="text-xs text-printflow-on-surface-variant mt-1.5">
        Computed as max(forecast × 2, ROP × 2) − current stock. Restores buffer to 2× ROP while covering predicted 14-day demand.
       </p>
      </div>
     </div>
    )}
   </Modal>
  </AdminLayout>
 );
}

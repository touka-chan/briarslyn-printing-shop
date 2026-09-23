"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Download, Package, AlertTriangle } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, FilterToolbar, DataTable, StatusBadge, Button, Modal, KpiCard, FeedErrorBanner, useToast } from "@/components/ui";
import { csvRow, downloadCsv } from "@/lib/csv";
import { subscribeInventory } from "@/lib/services/inventory";
import { useFeedStatus } from "@/lib/useFeedStatus";
import {
  useSparkSeries,
  inventoryCheckoutKey,
} from "@/lib/hooks/useSparkSeries";
import { getInventoryStatus } from "@/lib/derived";
import { InventoryItem } from "@/types";

export default function InventoryPage() {
 const [active, setActive] = useState("All");
 const [search, setSearch] = useState("");
 const [sel, setSel] = useState<InventoryItem | null>(null);
 const [open, setOpen] = useState(false);
 const [kpiModal, setKpiModal] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [ready, setReady] = useState(false);
  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  useEffect(() => {
   const unsub = subscribeInventory(
     (rows) => {
       setInventory(rows);
       setReady(true);
     },
     (e) => {
       onFeedError(e);
       // Never leave the page on a skeleton: render the error state.
       setReady(true);
     },
   );
   return () => unsub();
  }, [feedNonce, onFeedError]);

 // Live sparkline series - checkout history per day for the last 7 days.
 const totalVariantsSeries = useSparkSeries(inventory, inventoryCheckoutKey, 7);
 const lowStockSeries = useSparkSeries(
  inventory.filter((i) => getInventoryStatus(i) === "Low Stock"),
  inventoryCheckoutKey,
  7,
 );
 const insufficientSeries = useSparkSeries(
  inventory.filter((i) => getInventoryStatus(i) === "Insufficient Stock"),
  inventoryCheckoutKey,
  7,
 );
 const reorderSeries = useSparkSeries(
  inventory.filter((i) => i.current_stock <= i.reorder_point),
  inventoryCheckoutKey,
  7,
 );

 const tabs = useMemo(
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

 const filtered = useMemo(
  () =>
   active === "All"
    ? inventory
    : inventory.filter((i) => getInventoryStatus(i) === active),
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
 const alerts = useMemo(
  () => inventory.filter((i) => i.current_stock <= i.reorder_point),
  [inventory],
 );
 const stale = useMemo(() => inventory.filter((i) => i.isStale), [inventory]);
 const lowStock = useMemo(
  () => inventory.filter((i) => getInventoryStatus(i) === "Low Stock"),
  [inventory],
 );
 const insufficient = useMemo(
  () => inventory.filter((i) => getInventoryStatus(i) === "Insufficient Stock"),
  [inventory],
 );

 const cols = [
  { key: "material_variant_id", header: "Variant ID", render: (r:InventoryItem)=><span className="font-mono text-xs">{r.material_variant_id}</span> },
  { key: "item_type", header: "Item Type" },
  { key: "tag_uid", header: "Tag UID", render: (r:InventoryItem)=><span className="font-mono text-xs">{r.tag_uid}</span> },
  {
    key: "sensor_id",
    header: "Sensor (IoT)",
    render: (r:InventoryItem)=>(
      <span className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-printflow-on-surface-variant min-w-0">
        {r.sensor_id || 'ESP32-01'}
        <span
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${r.isStale ? "bg-zinc-400" : "bg-[#17171c] dark:bg-white animate-pulse"}`}
          title={r.isStale ? "Sync delayed (>12h)" : "Active connection"}
        ></span>
      </span>
    )
  },
  { key: "current_stock", header: "Stock", render: (r:InventoryItem)=>`${r.current_stock}` },
  { key: "reorder_point", header: "ROP (dynamic)", render: (r:InventoryItem)=><span className={r.current_stock<=r.reorder_point?"text-printflow-error font-bold":""}>{r.reorder_point}</span> },
  { key: "forecasted_demand_next_7_days", header: "Forecast 7d" },
  { key: "model", header: "Model", render: (r:InventoryItem)=><span className="text-xs break-words">{r.model}</span> },
  { key: "status", header: "Status", render: (r:InventoryItem)=><span className="flex flex-wrap items-center gap-1 min-w-0"><StatusBadge status={r.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={r.status} />{r.isStale&&<span className="text-[10px] px-1 py-0.5 rounded bg-printflow-warning-container text-printflow-warning whitespace-nowrap">Delayed</span>}</span> },
   { key: "actions", header: "", render: ()=><Eye className="w-4 h-4" /> },
   ];
  // KPI modals: compact columns only (no eye, no Tag UID, no Sensor —
  // those live in the row detail modal). 7 columns fit the modal
  // full-view with no bottom scrollbar.
  const modalCols = cols.filter(
   (c) => c.key !== "actions" && c.key !== "tag_uid" && c.key !== "sensor_id",
  );

  const toast = useToast();

  const handleExport = () => {
   if (searched.length === 0) return;
   const headers = [
    "material_variant_id",
    "item_type",
    "category",
    "current_stock",
    "reorder_point",
    "forecast_7d",
    "model",
    "status",
   ];
   const lines = [
    headers.join(","),
    ...searched.map((i) =>
     csvRow([
      i.material_variant_id,
      i.item_type,
      i.category,
      i.current_stock,
      i.reorder_point,
      i.forecasted_demand_next_7_days ?? "",
      i.model ?? "",
      getInventoryStatus(i),
     ]),
    ),
   ];
   downloadCsv(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, lines);
   toast.success(`Exported ${searched.length} materials`);
  };

   return (
   <AdminLayout title="Inventory" subtitle="Track materials and stock levels" onSearch={setSearch}>
    {feedError && (
     <FeedErrorBanner
      message={feedError}
      showCached={inventory.length > 0}
      onRetry={retryFeed}
     />
    )}
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
    <KpiCard
     label="Total Variants"
     value={inventory.length}
     icon="Package"
     sparkline={totalVariantsSeries}
     sparklineTone="primary"
     lastUpdated="7d"
     onClick={() => setKpiModal("total")}
     loading={!ready}
    />
    <KpiCard
     label="Low Stock"
     value={lowStock.length}
     icon="AlertTriangle"
     change="needs attention"
     changeType="negative"
     trend="up"
     sparkline={lowStockSeries}
     sparklineTone="warning"
     lastUpdated="7d"
     onClick={() => setKpiModal("low")}
     loading={!ready}
    />
    <KpiCard
     label="Insufficient"
     value={insufficient.length}
     icon="AlertTriangle"
     change="urgent"
     changeType="negative"
     trend="up"
     sparkline={insufficientSeries}
     sparklineTone="error"
     lastUpdated="7d"
     onClick={() => setKpiModal("insufficient")}
     loading={!ready}
    />
    <KpiCard
     label="Need Reorder"
     value={alerts.length}
     icon="AlertTriangle"
     change={`${stale.length} delayed`}
     changeType={stale.length ? "negative" : "positive"}
     trend="up"
     sparkline={reorderSeries}
     sparklineTone={stale.length ? "error" : "primary"}
     lastUpdated="7d"
     onClick={() => setKpiModal("reorder")}
     loading={!ready}
    />
   </div>

    <Modal isOpen={kpiModal==="total"} onClose={()=>setKpiModal(null)} title="Total Variants" description={`${inventory.length} variants - GET /api/inventory`} icon={<Package className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
      <DataTable columns={modalCols} data={inventory} keyExtractor={r=>r.material_variant_id} emptyMessage="No materials" pageSize={10} previewLimit={0} scrollable={false} />
    </Modal>
    <Modal isOpen={kpiModal==="low"} onClose={()=>setKpiModal(null)} title="Low Stock" description={`${lowStock.length} items - GET /api/inventory?status=Low Stock`} icon={<AlertTriangle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
      <DataTable columns={modalCols} data={lowStock} keyExtractor={r=>r.material_variant_id} emptyMessage="No low stock" pageSize={10} previewLimit={0} scrollable={false} />
    </Modal>
    <Modal isOpen={kpiModal==="insufficient"} onClose={()=>setKpiModal(null)} title="Insufficient Stock" description={`${insufficient.length} items - GET /api/inventory?status=Insufficient`} icon={<AlertTriangle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
      <DataTable columns={modalCols} data={insufficient} keyExtractor={r=>r.material_variant_id} emptyMessage="No insufficient stock" pageSize={10} previewLimit={0} scrollable={false} />
    </Modal>
    <Modal isOpen={kpiModal==="reorder"} onClose={()=>setKpiModal(null)} title="Need Reorder" description={`${alerts.length} items - stock <= ROP`} icon={<AlertTriangle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
      <DataTable columns={modalCols} data={alerts} keyExtractor={r=>r.material_variant_id} emptyMessage="No reorder needed" pageSize={10} previewLimit={0} scrollable={false} />
    </Modal>

    <ContentCard title="Materials" subtitle={`${searched.length} materials`} className="mb-6">
    <FilterToolbar tabs={tabs} activeTab={active} onTabChange={setActive} searchPlaceholder="Search material" onSearchChange={setSearch} searchValue={search} customActions={<Button variant="secondary" onClick={handleExport} disabled={searched.length === 0}><Download className="w-4 h-4" />Export</Button>} />
     <DataTable columns={cols} data={searched} keyExtractor={r=>r.material_variant_id} onRowClick={r=>{setSel(r); setOpen(true);}} emptyMessage="No materials" pageSize={25} loading={!ready} />
   </ContentCard>

   <ContentCard title="Reorder Alerts" subtitle={alerts.length>0 ? `${alerts.length} items need attention - stock <= ROP` : undefined}>
    {alerts.length===0 ? (
     <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-printflow-success-container flex items-center justify-center mb-3"><Package className="w-5 h-5 text-printflow-success" /></div>
      <p className="text-sm font-medium text-printflow-on-surface">All stocked</p>
      <p className="text-xs text-printflow-on-surface-variant">No materials below reorder point</p>
     </div>
    ) : (
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {alerts.map(item=> {
       const pct = Math.min(100, Math.round((item.current_stock / Math.max(item.reorder_point,1))*100));
       const isInsufficient = item.status==="Insufficient Stock";
       return (
        <div
         key={item.material_variant_id}
         onClick={()=>{setSel(item); setOpen(true);}}
         className="group flex flex-col gap-3 p-4 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 hover:border-printflow-outline-variant hover:shadow-sm hover:bg-printflow-surface-container/30 cursor-pointer transition-all"
        >
         <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3 min-w-0">
           <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isInsufficient ? "bg-printflow-error-container text-printflow-error" : "bg-printflow-warning-container text-printflow-warning"}`}>
            <AlertTriangle className="w-4 h-4" />
           </div>
           <div className="min-w-0">
            <p className="font-mono text-[13px] font-semibold text-printflow-on-surface leading-none tracking-tight">{item.material_variant_id}</p>
            <p className="text-[13px] font-medium text-printflow-on-surface leading-tight truncate">{item.item_type}</p>
            <p className="text-[11px] text-printflow-on-surface-variant">{item.category} - {item.tag_uid}</p>
           </div>
          </div>
          <StatusBadge status={item.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={item.status} />
         </div>

         <div className="grid grid-cols-3 gap-2">
          <div className="bg-printflow-surface-container rounded-lg px-3 py-2.5">
           <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant leading-none">STOCK</p>
           <p className="text-sm font-bold text-printflow-on-surface leading-tight mt-1">{item.current_stock}</p>
          </div>
          <div className="bg-printflow-surface-container rounded-lg px-3 py-2.5">
           <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant leading-none">ROP</p>
           <p className="text-sm font-bold text-printflow-on-surface leading-tight mt-1">{item.reorder_point}</p>
           <p className="text-[10px] text-printflow-on-surface-variant leading-none">{item.model}</p>
          </div>
          <div className="bg-printflow-surface-container rounded-lg px-3 py-2.5">
           <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant leading-none">FORECAST 7D</p>
           <p className="text-sm font-bold text-printflow-on-surface leading-tight mt-1">{item.forecasted_demand_next_7_days}</p>
          </div>
         </div>

         <div className="h-1.5 bg-printflow-surface-container rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${isInsufficient ? "bg-[#17171c] dark:bg-white" : "bg-zinc-400 dark:bg-zinc-500"}`} style={{ width: `${pct}%` }} />
         </div>
         <p className="text-[11px] text-printflow-on-surface-variant -mt-1">{pct}% of ROP - {isInsufficient ? "needs urgent reorder" : "below reorder point"}</p>
        </div>
       );
      })}
     </div>
    )}
   </ContentCard>

    <Modal isOpen={open} onClose={()=>{setOpen(false); setSel(null);}} title={sel ? `Variant ${sel.material_variant_id}` : "Variant"} description={sel ? `${sel.item_type} - ${sel.category}` : undefined} icon={<Package className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setOpen(false)}>Close</Button>}>
     {sel && (
      <div className="space-y-5">
       <div className="flex items-center justify-between p-4 bg-printflow-surface-container/50 rounded-xl border border-printflow-outline-variant/40">
        <div><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">VARIANT ID</p><p className="font-mono font-bold">{sel.material_variant_id}</p></div>
        <StatusBadge status={sel.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={sel.status} />
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">ITEM TYPE</p><p className="text-sm font-medium mt-1">{sel.item_type}</p></div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">CATEGORY</p><p className="text-sm font-medium mt-1">{sel.category}</p></div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">CURRENT STOCK</p><p className="text-sm font-bold mt-1">{sel.current_stock}</p></div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">REORDER POINT</p><p className="text-sm font-bold mt-1">{sel.reorder_point} <span className="text-xs font-normal text-printflow-on-surface-variant">({sel.model})</span></p></div>
        <div className="p-3.5 bg-printflow-primary/5 rounded-xl border border-printflow-primary/20"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">FORECAST 7D</p><p className="text-sm font-bold text-printflow-primary mt-1">{sel.forecasted_demand_next_7_days}</p></div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">TAG / SENSOR</p><p className="font-mono text-xs mt-1">{sel.tag_uid} - {sel.sensor_id}</p></div>
       </div>
      </div>
     )}
    </Modal>
  </AdminLayout>
 );
}

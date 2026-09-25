"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, AlertTriangle, TrendingUp, Package } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, DataTable, ChartCard, Button, KpiCard, Modal, StatusBadge, FeedErrorBanner, useToast } from "@/components/ui";
import { csvRow, downloadCsv } from "@/lib/csv";
import { subscribeInventory } from "@/lib/services/inventory";
import { subscribeRfidEvents } from "@/lib/services/rfid";
import { subscribeUsageEvents } from "@/lib/services/usage";
import { useFeedStatus } from "@/lib/useFeedStatus";
import {
  useSparkSeries,
  inventoryCheckoutKey,
} from "@/lib/hooks/useSparkSeries";
import { getInventoryStatus } from "@/lib/derived";
import { FORECAST_PARAMS, forecastVariantDemand } from "@/lib/forecast";
import { InventoryItem } from "@/types";
import type { RfidCheckoutEvent, UsageEvent } from "@/types";

export default function ForecastingPage() {
 const [active, setActive] = useState("All");
 const [search, setSearch] = useState("");
 const [showSource, setShowSource] = useState(false);
 const [kpiModal, setKpiModal] = useState<string | null>(null);
   const [inventory, setInventory] = useState<InventoryItem[]>([]);
   const [events, setEvents] = useState<RfidCheckoutEvent[]>([]);
   const [usage, setUsage] = useState<UsageEvent[]>([]);
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

  // Checkout history feeding the live forecast. Larger window than the
  // sensor screen's 50-event cap - the model consumes up to 28 days.
  useEffect(() => {
   const unsub = subscribeRfidEvents(setEvents, 500, onFeedError);
   return () => unsub();
  }, [feedNonce, onFeedError]);
  useEffect(() => {
   const unsub = subscribeUsageEvents(setUsage, 500, onFeedError);
   return () => unsub();
  }, [feedNonce, onFeedError]);

  // Demand signal: usage OUT movements (auto-deduct/manual/rfid) first;
  // legacy RFID taps count only for variants with no usage history yet
  // (afterwards taps are check-ins, not demand - no double count).
  const demandEvents = useMemo(() => {
   const out = usage.filter((u) => u.direction === "out");
   const withUsage = new Set(out.map((u) => u.material_variant_id));
   const mapped: RfidCheckoutEvent[] = out.map((u) => ({
    id: u.id ?? `${u.material_variant_id}-${u.timestamp ?? ""}`,
    material_variant_id: u.material_variant_id,
    tag_uid: "",
    sensor_id: "",
    timestamp: u.timestamp ?? new Date().toISOString(),
   }));
   const taps = events.filter((e) => !withUsage.has(e.material_variant_id));
   return [...mapped, ...taps];
  }, [usage, events]);

  // Live per-variant forecast computed from real consumption:
  // Holt-Winters on >= 2 weeks of history, single exponential smoothing
  // on thin history, stored planning values when a variant has no usage yet.
  const liveInventory = useMemo(() => {
   if (demandEvents.length === 0) return inventory;
   return inventory.map((item) => {
    const f = forecastVariantDemand(demandEvents, item.material_variant_id);
    if (!f.hasHistory) return item;
    return {
     ...item,
     reorder_point: f.rop,
     forecasted_demand_next_7_days: f.forecast7d,
     model: f.model,
     };
    });
   }, [inventory, demandEvents]);

 // Live sparkline series - checkout history per day for the last 7 days.
 const reorderSeries = useSparkSeries(
  liveInventory.filter((i) => i.current_stock <= i.reorder_point),
  inventoryCheckoutKey,
  7,
 );
 const insufficientSeries = useSparkSeries(
  liveInventory.filter((i) => getInventoryStatus(i) === "Insufficient Stock"),
  inventoryCheckoutKey,
  7,
 );
  // Model activity - real per-day checkout events for Holt-Winters
  // variants over the last 7 days (a flat line now means no recent
  // checkouts, not a placeholder).
  const holtWintersSeries = useSparkSeries(
   liveInventory.filter((i) => i.model === "Holt-Winters"),
   inventoryCheckoutKey,
   7,
  );
 const forecastDemandTotal = useMemo(
  () =>
   liveInventory.reduce(
    (sum, i) => sum + (i.forecasted_demand_next_7_days ?? 0),
    0,
   ),
  [liveInventory],
 );
 const forecast7dSeries = useSparkSeries(liveInventory, inventoryCheckoutKey, 7);

 const tabs = useMemo(
  () => [
   { id: "All", label: "All", count: liveInventory.length },
   {
    id: "Tarpaulin",
    label: "Tarpaulin",
    count: liveInventory.filter((i) => i.category === "Tarpaulin").length,
   },
   {
    id: "Ink",
    label: "Ink",
    count: liveInventory.filter((i) => i.category === "Ink").length,
   },
   {
    id: "Paper",
    label: "Paper",
    count: liveInventory.filter((i) => i.category === "Paper").length,
   },
   {
    id: "Mug",
    label: "Mug",
    count: liveInventory.filter((i) => i.category === "Mug").length,
   },
   {
    id: "Shirt",
    label: "Shirt",
    count: liveInventory.filter((i) => i.category === "Shirt").length,
    },
   ],
   [liveInventory],
  );

  const filtered = useMemo(
   () =>
    active === "All"
     ? liveInventory
     : liveInventory.filter((i) => i.category === active),
   [liveInventory, active],
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
  () => liveInventory.filter((i) => i.current_stock <= i.reorder_point),
  [liveInventory],
 );
 const critical = useMemo(
  () => liveInventory.filter((i) => getInventoryStatus(i) === "Insufficient Stock"),
  [liveInventory],
 );
 const holtWinters = useMemo(
  () => liveInventory.filter((i) => i.model === "Holt-Winters"),
  [liveInventory],
 );
 const expSmooth = useMemo(
  () => liveInventory.filter((i) => i.model === "Exponential Smoothing"),
  [liveInventory],
 );

 const cols = [
  { key: "material_variant_id", header: "Variant ID", render: (r:InventoryItem)=><span className="font-mono text-xs">{r.material_variant_id}</span> },
  { key: "item_type", header: "Item Type" },
  { key: "current_stock", header: "Stock" },
  { key: "reorder_point", header: "Threshold / ROP (Holt-Winters/Exp Smoothing)", render: (r:InventoryItem)=><span className={r.current_stock<=r.reorder_point?"text-printflow-error font-bold":""}>{r.reorder_point} ({r.model})</span> },
  { key: "forecasted_demand_next_7_days", header: "Forecast 7d" },
  { key: "tag_uid", header: "Tag UID", render: (r:InventoryItem)=><span className="font-mono text-xs">{r.tag_uid}</span> },
  { key: "sensor_id", header: "Sensor" },
 ];

  const statusCols = [
   { key: "material_variant_id", header: "Variant ID", render: (r:InventoryItem)=><span className="font-mono text-xs">{r.material_variant_id}</span> },
   { key: "item_type", header: "Item Type" },
   { key: "current_stock", header: "Stock" },
   { key: "reorder_point", header: "Threshold (ROP)" },
   { key: "status", header: "Status", render: (r:InventoryItem)=><StatusBadge status={r.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={r.status} /> },
  ];

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
   downloadCsv(`forecast-${new Date().toISOString().slice(0, 10)}.csv`, lines);
   toast.success(`Exported ${searched.length} forecast rows`);
  };

   return (
    <AdminLayout title="Forecasting" subtitle="Inventory forecasts and reorder planning" headerActions={<Button variant="secondary" onClick={handleExport} disabled={searched.length === 0}><Download className="w-4 h-4" />Export</Button>} onSearch={setSearch}>
    {feedError && (
     <FeedErrorBanner
      message={feedError}
      showCached={inventory.length > 0}
      onRetry={retryFeed}
     />
    )}
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
      loading={!ready}
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
      loading={!ready}
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
      loading={!ready}
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
      loading={!ready}
     />
    </div>

    <Modal isOpen={kpiModal==="reorder"} onClose={()=>setKpiModal(null)} title="Need Reorder" description={`${atRisk.length} items - stock <= ROP`} icon={<AlertTriangle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
      <DataTable columns={statusCols} data={atRisk} keyExtractor={r=>r.material_variant_id} emptyMessage="No reorder needed" pageSize={10} />
    </Modal>
    <Modal isOpen={kpiModal==="insufficient"} onClose={()=>setKpiModal(null)} title="Insufficient Stock" description={`${critical.length} items - GET /api/inventory`} icon={<AlertTriangle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
      <DataTable columns={statusCols} data={critical} keyExtractor={r=>r.material_variant_id} emptyMessage="None" pageSize={10} />
    </Modal>
    <Modal isOpen={kpiModal==="model"} onClose={()=>setKpiModal(null)} title="Forecast Model" description="Holt-Winters - GET /api/inventory/forecast" icon={<TrendingUp className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">HOLT WINTERS</p><p className="text-sm font-semibold mt-1">{holtWinters.length} variants</p><p className="text-xs text-printflow-on-surface-variant mt-1 truncate">{holtWinters.map(i=>i.material_variant_id).join(", ")}</p></div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">EXPONENTIAL SMOOTHING</p><p className="text-sm font-semibold mt-1">{expSmooth.length} variants</p><p className="text-xs text-printflow-on-surface-variant mt-1 truncate">{expSmooth.map(i=>i.material_variant_id).join(", ")}</p></div>
      </div>
       <DataTable columns={cols} data={liveInventory} keyExtractor={r=>r.material_variant_id} emptyMessage="No data" pageSize={10} />
     </div>
    </Modal>
    <Modal isOpen={kpiModal==="forecast"} onClose={()=>setKpiModal(null)} title="Forecast 7 Days" description="GET /api/inventory/forecast?days=7" icon={<Package className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
       <DataTable columns={cols} data={liveInventory} keyExtractor={r=>r.material_variant_id} emptyMessage="No forecast" pageSize={10} />
    </Modal>

   <div className="mb-6">
    <ChartCard title="Forecast vs Reorder Point" type="bar" data={liveInventory.map(i=>({name:i.material_variant_id, stock:i.current_stock, rop:i.reorder_point, forecast:i.forecasted_demand_next_7_days}))} xKey="name" yKeys={["stock","rop","forecast"]} colors={["var(--color-printflow-on-surface)","var(--color-printflow-on-surface-variant)","var(--color-printflow-outline)"]} height={340} loading={!ready} />
    <div className="mt-3">
     <button onClick={()=>setShowSource(!showSource)} className="text-xs px-3 py-1.5 rounded-full border border-printflow-outline-variant bg-printflow-surface hover:bg-printflow-surface-container">
      {showSource ? "Hide Details" : "Show Details"}
     </button>
    </div>
    {showSource && (
     <div className="mt-3 p-4 bg-printflow-surface-container rounded-lg border border-printflow-outline-variant text-sm space-y-2">
      <p className="font-semibold">RFID Checkout Source (POST /api/rfid/checkout)</p>
      <p className="font-mono text-xs bg-printflow-surface p-2 rounded border">Each tap = {"{material_variant_id, tag_uid, sensor_id: ESP32-01, timestamp}"} - -1 unit, debounce prevents duplicate.</p>
       <ul className="text-xs text-printflow-on-surface-variant list-disc pl-4 space-y-1">
        <li>ROP and 7-day demand on this page are computed live from usage movements (auto-deduct + manual logs + station entries; RFID taps where no usage exists yet). Variants with no movements yet show stored planning values.</li>
        <li>One tag per variant (TARP-MED, INK-BLACK, etc.), whole-unit only.</li>
       <li>Offline cached syncs when ESP32 reconnects.</li>
       <li>Example: TARP-MED - stock 2 - ROP 4 - reorder alert</li>
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
       <p className="text-sm font-semibold mt-1.5 text-printflow-primary">{FORECAST_PARAMS.alpha.toFixed(2)}</p>
      <p className="text-xs text-printflow-on-surface-variant mt-0.5">Base level smoothing</p>
     </div>
     <div className="p-3 bg-printflow-surface rounded-lg border border-printflow-outline-variant/50">
      <p className="text-[10px] font-medium tracking-wide text-printflow-on-surface-variant uppercase">Beta (Trend)</p>
       <p className="text-sm font-semibold mt-1.5 text-printflow-primary">{FORECAST_PARAMS.beta.toFixed(2)}</p>
      <p className="text-xs text-printflow-on-surface-variant mt-0.5">Trend component weight</p>
     </div>
     <div className="p-3 bg-printflow-surface rounded-lg border border-printflow-outline-variant/50">
      <p className="text-[10px] font-medium tracking-wide text-printflow-on-surface-variant uppercase">Gamma (Seasonality)</p>
       <p className="text-sm font-semibold mt-1.5 text-printflow-primary">{FORECAST_PARAMS.gamma.toFixed(2)}</p>
      <p className="text-xs text-printflow-on-surface-variant mt-0.5">Seasonal pattern weight</p>
     </div>
     <div className="p-3 bg-printflow-surface rounded-lg border border-printflow-outline-variant/50 sm:col-span-2">
      <p className="text-[10px] font-medium tracking-wide text-printflow-on-surface-variant uppercase">Seasonality Period (L)</p>
       <p className="text-sm font-semibold mt-1.5 text-printflow-primary">{FORECAST_PARAMS.seasonLength} intervals</p>
      <p className="text-xs text-printflow-on-surface-variant mt-0.5">Daily seasonal pattern (weekly cycle)</p>
     </div>
    </div>
   </div>

   <ContentCard title="Demand Forecast" subtitle={`${searched.length} materials`}>
    <div className="flex flex-wrap items-end gap-3 mb-4">
     <div className="min-w-[200px] flex-1">
      <label className="block text-xs text-printflow-on-surface-variant mb-1">
       Search
      </label>
      <input
       type="text"
       value={search}
       onChange={(e) => setSearch(e.target.value)}
       placeholder="Search material"
       className="w-full px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
      />
     </div>
     <div>
      <label className="block text-xs text-printflow-on-surface-variant mb-1">
       Category
      </label>
      <select
       value={active}
       onChange={(e) => setActive(e.target.value)}
       className="px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
      >
       {tabs.map((t) => (
        <option key={t.id} value={t.id}>
         {t.id === "All" ? `All (${t.count})` : `${t.label} (${t.count})`}
        </option>
       ))}
      </select>
     </div>
    </div>
     <DataTable columns={cols} data={searched} keyExtractor={r=>r.material_variant_id} emptyMessage="No forecast" pageSize={25} loading={!ready} />
   </ContentCard>
  </AdminLayout>
 );
}

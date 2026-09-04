"use client";

import { useState, useMemo } from "react";
import { Calendar, Download, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout";
import { ContentCard, FilterToolbar, ChartCard, Button, useToast } from "@/components/ui";
import { chartData, mockInventory, mockOrders } from "@/lib/mockData";

const ranges = [
 { id: "7d", label: "Last 7 Days" },
 { id: "30d", label: "Last 30 Days" },
];

const ordersTrend30d = Array.from({ length: 30 }, (_, i) => {
 const base = 18 + ((i * 7) % 19);
 const completed = Math.max(8, Math.round(base * 0.78) + ((i % 3) - 1));
 return { name: `D${i + 1}`, orders: base, completed, pending: base - completed };
});

export default function AnalyticsPage() {
 const [active, setActive] = useState("7d");
 const trendData = active === "7d" ? chartData.ordersTrend : ordersTrend30d;
 const toast = useToast();

 // Derive counts from live mock data
 const lowStockCount = useMemo(
  () => mockInventory.filter((i) => i.status === "Low Stock").length,
  [],
 );
 const insufficientCount = useMemo(
  () => mockInventory.filter((i) => i.status === "Insufficient Stock").length,
  [],
 );
 const delayedSyncCount = useMemo(() => mockInventory.filter((i) => i.isStale).length, []);
 const onTimePct = useMemo(() => {
  const total = mockOrders.length;
  if (total === 0) return 0;
  const onTime = mockOrders.filter((o) => o.priority !== "Overdue").length;
  return Math.round((onTime / total) * 100);
 }, []);
 const pendingTotal = useMemo(
  () => trendData.reduce((a, b) => a + b.pending, 0),
  [trendData],
 );

 const handleExport = () => {
  toast.success(
   `Exported analytics (${active === "7d" ? "7 days" : "30 days"}) to CSV`,
  );
 };

 return (
  <AdminLayout
   title="Analytics"
   subtitle="Insights on orders and materials"
   headerActions={
    <Button variant="secondary" onClick={handleExport}>
     <Download className="w-4 h-4" />
     Export
    </Button>
   }
  >
   <div className="space-y-8">
    <ContentCard>
     <FilterToolbar
      tabs={ranges}
      activeTab={active}
      onTabChange={setActive}
      customActions={
       <Button
        variant="secondary"
        onClick={() => toast.info("Custom date range — coming soon")}
       >
        <Calendar className="w-4 h-4" />
        Custom Range
       </Button>
      }
     />
    </ContentCard>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
     <ChartCard
      title="Order Volume Trends"
      subtitle={active === "7d" ? "Orders per day (descriptive) • Last 7 Days" : "Orders per day (descriptive) • Last 30 Days"}
      type="area"
      data={trendData}
      xKey="name"
      yKeys={["orders", "completed", "pending"]}
      colors={["#00535b", "#2e7d32", "#ed6c02"]}
      height={320}
     />
     <ChartCard
      title="On-time vs Overdue Completion Rates"
      subtitle="Target: Overdue flagged by priority"
      type="pie"
      data={chartData.onTimeVsOverdue}
      xKey="name"
      yKeys={["value"]}
      colors={["#2e7d32", "#ba1a1a"]}
      height={320}
     />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
     <ChartCard
      title="Material Usage"
      type="bar"
      data={chartData.materialUsageTrends}
      xKey="name"
      yKeys={["usage"]}
      colors={["#00535b"]}
      height={320}
      showLegend={false}
     />
     <ContentCard
      title="Restock Forecast"
      subtitle="Preview — full details on Forecasting page"
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
       <p>
        <span className="font-semibold">TARP-MED:</span> ROP 4, Forecast 9{" "}
        <span className="text-printflow-error">Needs reorder</span>
       </p>
       <p>
        <span className="font-semibold">MUG-WHITE-11OZ:</span> ROP 12, Forecast 15{" "}
        <span className="text-printflow-error">Needs reorder</span>
       </p>
       <p>
        <span className="font-semibold">PAPER-A4-80GSM:</span> ROP 60, Forecast 45{" "}
        <span className="text-printflow-success">In Stock</span>
       </p>
      </div>
     </ContentCard>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
     <ContentCard title="On-time" className="text-center">
      <div className="text-3xl font-bold text-printflow-success">{onTimePct}%</div>
      <p className="text-xs text-printflow-on-surface-variant">of {mockOrders.length} orders</p>
     </ContentCard>
     <ContentCard title="Pending" className="text-center">
      <div className="text-3xl font-bold">{pendingTotal}</div>
      <p className="text-xs text-printflow-on-surface-variant">
       in selected range
      </p>
     </ContentCard>
     <ContentCard title="Low Stock" className="text-center">
      <div className="text-3xl font-bold text-printflow-warning">{lowStockCount}</div>
      <p className="text-xs text-printflow-on-surface-variant">materials</p>
     </ContentCard>
     <ContentCard title="Delayed Sync" className="text-center">
      <div className="text-3xl font-bold text-printflow-warning flex items-center justify-center gap-1.5">
       {delayedSyncCount > 0 && <AlertTriangle className="w-5 h-5" />}
       {delayedSyncCount}
      </div>
      <p className="text-xs text-printflow-on-surface-variant">need RFID sync</p>
     </ContentCard>
    </div>
   </div>
  </AdminLayout>
 );
}

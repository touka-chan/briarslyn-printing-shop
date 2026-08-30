"use client";

import { useState } from "react";
import { Calendar, Download, TrendingUp } from "lucide-react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout";
import { ContentCard, FilterToolbar, ChartCard, Button } from "@/components/ui";
import { chartData } from "@/lib/mockData";

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
 return (
  <AdminLayout title="Analytics" subtitle="Insights on orders and materials" headerActions={<Button variant="secondary"><Download className="w-4 h-4" />Export</Button>}>
   <ContentCard>
    <FilterToolbar tabs={ranges} activeTab={active} onTabChange={setActive} customActions={<Button variant="secondary"><Calendar className="w-4 h-4" />Custom Range</Button>} />
   </ContentCard>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
     <ChartCard title="Order Volume Trends" subtitle={active === "7d" ? "Orders per day (descriptive) • Last 7 Days" : "Orders per day (descriptive) • Last 30 Days"} type="area" data={trendData} xKey="name" yKeys={["orders","completed","pending"]} colors={["#00535b","#2e7d32","#ed6c02"]} height={320} />
     <ChartCard title="On-time vs Overdue Completion Rates" subtitle="Target: Overdue flagged by priority" type="pie" data={chartData.onTimeVsOverdue} xKey="name" yKeys={["value"]} colors={["#2e7d32","#ba1a1a"]} height={320} />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
     <ChartCard title="Material Usage" type="bar" data={chartData.materialUsageTrends} xKey="name" yKeys={["usage"]} colors={["#00535b"]} height={320} showLegend={false} />
     <ContentCard title="Restock Forecast" subtitle="Preview — full details on Forecasting page" action={<Link href="/forecasting"><Button variant="secondary"><TrendingUp className="w-4 h-4" />View Forecasting</Button></Link>}>
      <div className="space-y-2 text-sm">
       <p><span className="font-semibold">TARP-MED:</span> ROP 4, Forecast 9 <span className="text-printflow-error">Needs reorder</span></p>
       <p><span className="font-semibold">MUG-WHITE-11OZ:</span> ROP 12, Forecast 15 <span className="text-printflow-error">Needs reorder</span></p>
       <p><span className="font-semibold">PAPER-A4-80GSM:</span> ROP 60, Forecast 45 In Stock</p>
      </div>
     </ContentCard>
    </div>

    <div className="grid grid-cols-4 gap-4">
     <ContentCard title="On-time" className="text-center"><div className="text-3xl font-bold text-printflow-success">82%</div><p className="text-xs">On-time</p></ContentCard>
     <ContentCard title="Pending" className="text-center"><div className="text-3xl font-bold">{trendData.reduce((a,b)=>a+b.pending,0)}</div><p className="text-xs">Pending</p></ContentCard>
     <ContentCard title="Low Stock" className="text-center"><div className="text-3xl font-bold text-printflow-warning">3</div><p className="text-xs">Materials</p></ContentCard>
     <ContentCard title="Delayed Sync" className="text-center"><div className="text-3xl font-bold text-printflow-warning">1</div><p className="text-xs">Needs sync</p></ContentCard>
    </div>
  </AdminLayout>
 );
}
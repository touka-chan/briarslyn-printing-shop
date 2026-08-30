"use client";

import { useState } from "react";
import { Download, FileText, Calendar, Factory, Package, ShoppingCart } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, FilterToolbar, Button, ChartCard, KpiCard } from "@/components/ui";
import { chartData, mockInventory, mockOrders } from "@/lib/mockData";

const timeRanges = [
 { id: "week", label: "This Week" },
 { id: "month", label: "This Month" },
 { id: "quarter", label: "This Quarter" },
];

export default function ReportsPage() {
 const [activeRange, setActiveRange] = useState("month");

  return (
   <AdminLayout title="Reports" subtitle="Generate and download operational reports">
    <div className="space-y-8">
    <ContentCard title="Generate Report">
     <FilterToolbar tabs={timeRanges} activeTab={activeRange} onTabChange={setActiveRange} />
     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
      <Button variant="primary"><FileText className="w-4 h-4" />Orders Report</Button>
      <Button variant="primary"><Package className="w-4 h-4" />Inventory Report</Button>
      <Button variant="primary"><Factory className="w-4 h-4" />Production Report</Button>
     </div>
    </ContentCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
       <ContentCard title="Orders by Priority" subtitle="Distribution by target date" className="min-w-0 overflow-hidden">
        <div className="pt-3">
          <ChartCard title="" type="bar" data={chartData.productionByPriority} xKey="name" yKeys={["value"]} colors={["#00535b"]} height={260} showLegend={false} />
        </div>
        <Button variant="secondary" className="mt-6 w-full"><Download className="w-4 h-4" />Download Orders PDF</Button>
       </ContentCard>
       <ContentCard title="Stock by Status" subtitle="Current inventory status" className="min-w-0 overflow-hidden">
        <div className="pt-3">
          <ChartCard title="" type="pie" data={chartData.inventoryByStatus} xKey="name" yKeys={["value"]} height={260} />
        </div>
        <Button variant="secondary" className="mt-6 w-full"><Download className="w-4 h-4" />Download Inventory CSV</Button>
       </ContentCard>
       <ContentCard title="Production Summary" subtitle="Overall operations" className="min-w-0 overflow-hidden">
        <div className="pt-3">
          <ChartCard title="" type="pie" data={[{name:"Pending",value:mockOrders.filter(o=>o.status==="Pending").length},{name:"Completed",value:mockOrders.filter(o=>o.status==="Completed").length},{name:"Low Stock",value:mockInventory.filter(i=>i.status!=="In Stock").length}]} xKey="name" yKeys={["value"]} colors={["#ed6c02","#2e7d32","#ba1a1a"]} height={260} />
        </div>
        <Button variant="secondary" className="mt-6 w-full"><Download className="w-4 h-4" />Download Production PDF</Button>
       </ContentCard>
      </div>

    <ContentCard title="Key Metrics (from dashboard summary)">
     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <KpiCard label="Total Orders" value={58} icon="OrdersIcon" />
      <KpiCard label="Pending" value={12} icon="Clock" />
      <KpiCard label="Completed" value={40} icon="CheckIcon" />
      <KpiCard label="Low Stock Items" value={3} icon="AlertIcon" />
     </div>
    </ContentCard>

    <ContentCard title="Recent Generated Reports">
     <div className="space-y-3 text-sm">
      {[
       { name: "Orders 2026-08-01 to 2026-08-14", type: "Orders", format: "PDF" },
       { name: "Inventory 2026-08-01 to 2026-08-14", type: "Inventory", format: "CSV" },
       { name: "Production 2026-08-01 to 2026-08-14", type: "Production", format: "PDF" },
      ].map(r=>(
       <div key={r.name} className="flex items-center justify-between p-3.5 bg-printflow-surface-container rounded-xl border border-printflow-outline-variant/30">
        <span className="text-sm font-medium">{r.name} ({r.format})</span><Button variant="ghost" size="sm"><Download className="w-4 h-4" /></Button>
       </div>
      ))}
     </div>
    </ContentCard>
    </div>
   </AdminLayout>
 );
}
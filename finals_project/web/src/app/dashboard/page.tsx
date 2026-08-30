"use client";

import { useState } from "react";
import { Package, Clock, CheckCircle, AlertTriangle, ShoppingCart, Factory, TrendingUp } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { KpiCard, ContentCard, FilterToolbar, DataTable, StatusBadge, ChartCard, Modal, Button } from "@/components/ui";
import { mockDashboardSummary, mockOrders, mockInventory, mockProduction, chartData } from "@/lib/mockData";
import { Order, InventoryItem, ProductionJob } from "@/types";

export default function DashboardPage() {
 const [activePriority, setActivePriority] = useState("All");
 const [activeStockFilter, setActiveStockFilter] = useState("All");
 const [searchValue, setSearchValue] = useState("");
 const [kpiModal, setKpiModal] = useState<string | null>(null);

 const priorityTabs = [
  { id: "All", label: "All", count: mockOrders.length },
  { id: "Overdue", label: "Overdue", count: mockOrders.filter(o => o.priority === "Overdue").length },
  { id: "Urgent", label: "Urgent", count: mockOrders.filter(o => o.priority === "Urgent").length },
  { id: "Upcoming", label: "Upcoming", count: mockOrders.filter(o => o.priority === "Upcoming").length },
 ];

 const stockTabs = [
  { id: "All", label: "All", count: mockInventory.length },
  { id: "In Stock", label: "In Stock", count: mockInventory.filter(i => i.status === "In Stock").length },
  { id: "Low Stock", label: "Low Stock", count: mockInventory.filter(i => i.status === "Low Stock").length },
  { id: "Insufficient Stock", label: "Insufficient", count: mockInventory.filter(i => i.status === "Insufficient Stock").length },
 ];

  const priorityRank: Record<Order["priority"], number> = { Overdue: 0, Urgent: 1, Upcoming: 2 };
  const filteredByPriority = (activePriority === "All"
    ? [...mockOrders].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.target_date.localeCompare(b.target_date))
    : mockOrders.filter(o => o.priority === activePriority).sort((a,b)=> a.target_date.localeCompare(b.target_date)));
  const filteredInventory = activeStockFilter === "All" ? mockInventory : mockInventory.filter(i => i.status === activeStockFilter);
 const reorderAlerts = mockInventory.filter(i => i.current_stock <= i.reorder_point);
 const staleItems = mockInventory.filter(i => i.isStale);
 const overdueOrders = mockOrders.filter(o => o.priority === "Overdue");
 const pendingOrders = mockOrders.filter(o => o.status === "Pending" || o.status === "In Production" || o.status === "Ready for Pickup");
 const completedOrders = mockOrders.filter(o => o.status === "Completed");

 const orderColumns = [
  { key: "order_id", header: "Order ID", render: (r: Order) => <span className="font-mono text-xs">{r.order_id}</span> },
  { key: "customer_name", header: "Customer" },
  { key: "item_type", header: "Item Type" },
  { key: "quantity", header: "Qty", render: (r: Order) => r.quantity.toLocaleString() },
  { key: "target_date", header: "Target Date" },
  { key: "priority", header: "Priority", render: (r: Order) => (
   <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${r.priority==="Overdue"?"bg-printflow-error-container text-printflow-on-error-container":r.priority==="Urgent"?"bg-printflow-warning-container text-printflow-warning":"bg-printflow-primary-fixed/20 text-printflow-primary"}`}>{r.priority}</span>
  )},
  { key: "status", header: "Status", render: (r: Order) => <StatusBadge status={r.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={r.status} /> },
  { key: "estimated_completion", header: "ETA", render: (r: Order) => (
   <div>
    <div className="font-medium text-xs">{r.estimated_completion}</div>
    <div className="text-[10px] text-printflow-on-surface-variant">{r.based_on?.join(", ")}</div>
   </div>
  )},
 ];

 const inventoryColumns = [
  { key: "material_variant_id", header: "Variant ID", render: (r: InventoryItem) => <span className="font-mono text-xs">{r.material_variant_id}</span> },
  { key: "item_type", header: "Item Type" },
  { key: "current_stock", header: "Stock", render: (r: InventoryItem) => `${r.current_stock} (thr:${r.threshold})` },
  { key: "reorder_point", header: "ROP", render: (r: InventoryItem) => <span className={r.current_stock <= r.reorder_point ? "text-printflow-error font-bold" : ""}>{r.reorder_point}</span> },
  { key: "forecasted_demand_next_7_days", header: "Forecast 7d" },
  { key: "status", header: "Status", render: (r: InventoryItem) => (
   <span className="flex items-center gap-2">
    <StatusBadge status={r.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={r.status} />
    {r.isStale && <span className="text-[10px] px-1.5 py-0.5 rounded bg-printflow-warning-container text-printflow-warning">STALE</span>}
   </span>
  )},
 ];

 const productionColumns = [
  { key: "order_id", header: "Order ID", render: (r: ProductionJob) => <span className="font-mono text-xs">{r.order_id}</span> },
  { key: "item_type", header: "Item Type" },
  { key: "priority", header: "Priority", render: (r: ProductionJob) => (
   <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${r.priority==="Overdue"?"bg-printflow-error-container text-printflow-on-error-container":r.priority==="Urgent"?"bg-printflow-warning-container text-printflow-warning":"bg-printflow-primary-fixed/20 text-printflow-primary"}`}>{r.priority}</span>
  )},
  { key: "status", header: "Status", render: (r: ProductionJob) => <StatusBadge status={r.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={r.status} /> },
  { key: "target_date", header: "Target Date" },
  { key: "estimated_completion", header: "ETA" },
 ];

 return (
  <AdminLayout
   title="Briaslyn Printing Shop Dashboard"
   subtitle="Overview of orders, production and inventory"
   onSearch={setSearchValue}
  >
   {/* Row 1: Key Metrics from dashboard summary */}
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
    <KpiCard label="Total Orders" value={mockDashboardSummary.total_orders} icon="OrdersIcon" change="all orders" changeType="neutral" onClick={()=>setKpiModal("total")} />
    <KpiCard label="Pending" value={mockDashboardSummary.pending} icon="Clock" change={`${overdueOrders.length} overdue`} changeType="negative" trend="up" onClick={()=>setKpiModal("pending")} />
    <KpiCard label="Completed" value={mockDashboardSummary.completed} icon="CheckIcon" change="82% on-time" changeType="positive" trend="up" onClick={()=>setKpiModal("completed")} />
    <KpiCard label="Low Stock Items" value={mockDashboardSummary.low_stock_items} icon="AlertIcon" change={`${reorderAlerts.length} need reorder`} changeType="negative" trend="up" onClick={()=>setKpiModal("lowStock")} />
   </div>

   {/* Row 2: Additional metrics */}
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
    <KpiCard label="On-time" value="82%" icon="CheckIcon" change="on-time rate" changeType="positive" trend="up" onClick={()=>setKpiModal("onTime")} />
    <KpiCard label="Pending" value={mockProduction.length} icon="Clock" change="in queue" changeType="negative" trend="up" onClick={()=>setKpiModal("productionPending")} />
    <KpiCard label="Low Stock" value={`${reorderAlerts.length}`} icon="AlertIcon" change="materials" changeType="negative" trend="up" onClick={()=>setKpiModal("lowStock")} />
    <KpiCard label="Delayed Sync" value={staleItems.length} icon="AlertIcon" change="needs sync" changeType="negative" trend="up" onClick={()=>setKpiModal("delayed")} />
   </div>

    {/* KPI Modals — unified users master style */}
    <Modal isOpen={kpiModal==="total"} onClose={()=>setKpiModal(null)} title="Total Orders" description={`${mockDashboardSummary.total_orders} orders • GET /api/orders`} icon={<ShoppingCart className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <div className="space-y-4">
      <DataTable columns={orderColumns} data={mockOrders} keyExtractor={r=>r.order_id} emptyMessage="No orders" />
     </div>
    </Modal>

    <Modal isOpen={kpiModal==="pending"} onClose={()=>setKpiModal(null)} title="Pending" description={`${pendingOrders.length} orders • GET /api/orders/queue`} icon={<Clock className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <DataTable columns={orderColumns} data={pendingOrders} keyExtractor={r=>r.order_id} emptyMessage="No pending orders" />
    </Modal>

    <Modal isOpen={kpiModal==="completed"} onClose={()=>setKpiModal(null)} title="Completed" description={`${completedOrders.length} orders • GET /api/orders?status=Completed`} icon={<CheckCircle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <DataTable columns={orderColumns} data={completedOrders} keyExtractor={r=>r.order_id} emptyMessage="No completed orders" />
    </Modal>

    <Modal isOpen={kpiModal==="lowStock"} onClose={()=>setKpiModal(null)} title="Low Stock" description={`${reorderAlerts.length} materials • stock ≤ ROP`} icon={<AlertTriangle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <DataTable columns={inventoryColumns} data={reorderAlerts} keyExtractor={r=>r.material_variant_id} emptyMessage="All stocked" />
    </Modal>

    <Modal isOpen={kpiModal==="onTime"} onClose={()=>setKpiModal(null)} title="On time 82%" description="GET /api/orders • on time vs overdue" icon={<TrendingUp className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 text-center"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">ON TIME</p><p className="text-xl font-bold text-printflow-success mt-1">82%</p></div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 text-center"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">OVERDUE</p><p className="text-xl font-bold text-printflow-error mt-1">{overdueOrders.length}</p></div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 text-center"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">PENDING</p><p className="text-xl font-bold mt-1">{pendingOrders.length}</p></div>
      </div>
      <DataTable columns={orderColumns} data={overdueOrders} keyExtractor={r=>r.order_id} emptyMessage="No overdue orders" />
     </div>
    </Modal>

    <Modal isOpen={kpiModal==="productionPending"} onClose={()=>setKpiModal(null)} title="Pending Production" description={`${mockProduction.length} jobs • priority Overdue/Urgent/Upcoming`} icon={<Factory className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     <DataTable columns={productionColumns} data={mockProduction} keyExtractor={r=>r.order_id} emptyMessage="No jobs" />
    </Modal>

    <Modal isOpen={kpiModal==="delayed"} onClose={()=>setKpiModal(null)} title="Delayed Sync" description={`${staleItems.length} needs sync • ESP32 isStale`} icon={<AlertTriangle className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setKpiModal(null)}>Close</Button>}>
     {staleItems.length>0 ? <DataTable columns={inventoryColumns} data={staleItems} keyExtractor={r=>r.material_variant_id} emptyMessage="All synced" /> : <p className="text-sm text-printflow-on-surface-variant">All materials synced</p>}
    </Modal>

   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
    <ChartCard title="Order Volume Trends" type="area" data={chartData.ordersTrend} xKey="name" yKeys={["orders","completed","pending"]} colors={["#00535b","#2e7d32","#ed6c02"]} height={280} />
    <ChartCard title="On-time vs Overdue" type="pie" data={chartData.onTimeVsOverdue} xKey="name" yKeys={["value"]} colors={["#2e7d32","#ba1a1a"]} height={280} />
   </div>
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
    <ChartCard title="Material Usage" type="bar" data={chartData.materialUsageTrends} xKey="name" yKeys={["usage"]} colors={["#00535b"]} height={260} showLegend={false} />
    <ChartCard title="Production by Priority" type="bar" data={chartData.productionByPriority} xKey="name" yKeys={["value"]} colors={["#00535b"]} height={260} showLegend={false} />
   </div>

     <div className="space-y-8">
      <ContentCard title="Production Queue" subtitle={`${filteredByPriority.length} orders`} className="min-w-0 overflow-hidden w-full">
       <div className="space-y-5">
         <FilterToolbar tabs={priorityTabs} activeTab={activePriority} onTabChange={setActivePriority} searchPlaceholder="Search order or customer" onSearchChange={setSearchValue} searchValue={searchValue} />
         <div className="overflow-x-auto -mx-6 px-6">
           <DataTable columns={orderColumns} data={filteredByPriority} keyExtractor={r=>r.order_id} emptyMessage="No orders" />
         </div>
       </div>
      </ContentCard>

       <ContentCard title="Inventory" subtitle={`${filteredInventory.length} materials`} className="min-w-0 overflow-hidden w-full">
        <div className="space-y-5">
          <FilterToolbar tabs={stockTabs} activeTab={activeStockFilter} onTabChange={setActiveStockFilter} searchPlaceholder="Search material" />
          <div className="overflow-x-auto -mx-6 px-6">
            <DataTable columns={inventoryColumns} data={filteredInventory} keyExtractor={r=>r.material_variant_id} emptyMessage="No materials" />
          </div>
        </div>
       </ContentCard>
       <ContentCard title="Production Schedule" subtitle={`${mockProduction.length} active jobs`} className="min-w-0 overflow-hidden w-full">
        <div className="overflow-x-auto -mx-6 px-6 py-3">
          <DataTable columns={productionColumns} data={mockProduction} keyExtractor={r=>r.order_id} emptyMessage="No jobs" />
        </div>
       </ContentCard>
      </div>
  </AdminLayout>
 );
}

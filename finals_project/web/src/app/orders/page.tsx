"use client";

import { useState } from "react";
import { Eye, Download, ShoppingCart, AlertTriangle } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, FilterToolbar, DataTable, StatusBadge, Button, Modal } from "@/components/ui";
import { mockOrders, mockInventory } from "@/lib/mockData";
import { Order } from "@/types";

export default function OrdersPage() {
 const [activePriority, setActivePriority] = useState("All");
 const [searchValue, setSearchValue] = useState("");
 const [selected, setSelected] = useState<Order | null>(null);
 const [open, setOpen] = useState(false);

 const tabs = [
  { id: "All", label: "All", count: mockOrders.length },
  { id: "Overdue", label: "Overdue", count: mockOrders.filter(o => o.priority === "Overdue").length },
  { id: "Urgent", label: "Urgent", count: mockOrders.filter(o => o.priority === "Urgent").length },
  { id: "Upcoming", label: "Upcoming", count: mockOrders.filter(o => o.priority === "Upcoming").length },
 ];

 const filtered = activePriority === "All" ? mockOrders : mockOrders.filter(o => o.priority === activePriority);
 const searched = filtered.filter(o =>
  !searchValue || `${o.order_id} ${o.customer_name} ${o.item_type}`.toLowerCase().includes(searchValue.toLowerCase())
 );

 const cols = [
  { key: "order_id", header: "Order ID", render: (r: Order) => <span className="font-mono text-xs">{r.order_id}</span> },
  { key: "customer_name", header: "Customer" },
  { key: "item_type", header: "Item Type" },
  { key: "quantity", header: "Qty", render: (r: Order) => r.quantity.toLocaleString() },
  { key: "layout_file", header: "Layout", render: (r: Order) => <span className="text-xs underline">{r.layout_file}</span> },
  { key: "target_date", header: "Target Date" },
  { key: "priority", header: "Priority", render: (r: Order) => (
   <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${r.priority==="Overdue"?"bg-printflow-error-container text-printflow-on-error-container":r.priority==="Urgent"?"bg-printflow-warning-container text-printflow-warning":"bg-printflow-primary-fixed/20 text-printflow-primary"}`}>{r.priority}</span>
  )},
  { key: "status", header: "Status", render: (r: Order) => <StatusBadge status={r.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={r.status} /> },
  { key: "estimated_completion", header: "ETA", render: (r: Order) => <span className="text-xs">{r.estimated_completion}</span> },
  { key: "payment_amount", header: "Payment", render: (r: Order) => `₱${r.payment_amount.toLocaleString()}` },
  { key: "actions", header: "", render: () => <Eye className="w-4 h-4" /> },
 ];

 return (
  <AdminLayout
   title="Orders"
   subtitle="Monitor customer orders and priorities"
   onSearch={setSearchValue}
  >
   <ContentCard title="All Orders" subtitle={`${searched.length} orders`}>
    <FilterToolbar tabs={tabs} activeTab={activePriority} onTabChange={setActivePriority} searchPlaceholder="Search order or customer" onSearchChange={setSearchValue} searchValue={searchValue} customActions={<Button variant="secondary"><Download className="w-4 h-4" />Export</Button>} />
    <DataTable columns={cols} data={searched} keyExtractor={r=>r.order_id} onRowClick={r=>{setSelected(r); setOpen(true);}} emptyMessage="No orders" />
   </ContentCard>

     <Modal isOpen={open} onClose={()=>{setOpen(false); setSelected(null);}} title={selected ? `Order ${selected.order_id}` : "Order Details"} description={selected ? `${selected.customer_name} • ${selected.item_type}` : undefined} icon={<ShoppingCart className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setOpen(false)}>Close</Button>}>
      {selected && (()=> {
        const related = mockInventory.find(i=> i.item_type === selected.item_type || selected.item_type.toLowerCase().includes(i.category.toLowerCase()));
        const isLow = related ? related.current_stock <= related.reorder_point : false;
        return (
       <div className="space-y-5">
        {isLow && related && (
          <div className="flex items-start gap-2.5 p-3.5 bg-printflow-error-container/20 border border-printflow-error-container/40 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-printflow-error shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-printflow-on-error-container">Insufficient stock indicator</p>
              <p className="text-xs text-printflow-on-surface-variant">Material {related.material_variant_id} ({related.item_type}) Stock {related.current_stock} ≤ ROP {related.reorder_point} — prompting restock per Workflow VII</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between p-4 bg-printflow-surface-container/50 rounded-xl border border-printflow-outline-variant/40">
         <div>
          <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">ORDER ID</p>
          <p className="font-mono font-bold text-printflow-on-surface leading-tight">{selected.order_id}</p>
         </div>
         <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${selected.priority==="Overdue"?"bg-printflow-error-container text-printflow-on-error-container":selected.priority==="Urgent"?"bg-printflow-warning-container text-printflow-warning":"bg-printflow-primary-fixed text-printflow-on-primary-fixed"}`}>{selected.priority}</span>
          <StatusBadge status={selected.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={selected.status} />
         </div>
        </div>

       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">CUSTOMER</p>
         <p className="text-sm font-medium text-printflow-on-surface mt-1">{selected.customer_name}</p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">EMAIL</p>
         <p className="text-sm font-medium text-printflow-on-surface mt-1 truncate">{selected.customer_email || "—"}</p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">PHONE</p>
         <p className="text-sm font-medium text-printflow-on-surface mt-1">{selected.customer_phone || "—"}</p>
        </div>
       </div>

       <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">ITEM TYPE</p>
         <p className="text-sm font-medium text-printflow-on-surface mt-1">{selected.item_type}</p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">QUANTITY</p>
         <p className="text-sm font-medium text-printflow-on-surface mt-1">{selected.quantity.toLocaleString()} pcs</p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">LAYOUT FILE</p>
         <p className="text-sm font-medium text-printflow-primary mt-1 underline decoration-dotted cursor-pointer">{selected.layout_file}</p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">TARGET DATE</p>
         <p className="text-sm font-medium text-printflow-on-surface mt-1">{selected.target_date}</p>
        </div>
        <div className="p-3.5 bg-printflow-primary/5 rounded-xl border border-printflow-primary/20">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">ESTIMATED COMPLETION</p>
         <p className="text-sm font-bold text-printflow-primary mt-1">{selected.estimated_completion}</p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">STATUS</p>
         <div className="mt-1.5"><StatusBadge status={selected.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={selected.status} /></div>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">PAYMENT</p>
         <p className="text-sm font-medium text-printflow-on-surface mt-1">₱{selected.payment_amount.toLocaleString()}</p>
        </div>
        <div className={`p-3.5 rounded-xl border ${selected.payment_status==="Paid"?"bg-printflow-success-container/30 border-printflow-success/20":selected.payment_status==="Partial"?"bg-printflow-warning-container border-printflow-warning/20":"bg-printflow-error-container/30 border-printflow-error/20"}`}>
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">PAID STATUS</p>
         <span className={`inline-flex mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${selected.payment_status==="Paid"?"bg-printflow-success text-white":selected.payment_status==="Partial"?"bg-printflow-warning text-white":"bg-printflow-error text-white"}`}>{selected.payment_status || "Unpaid"}</span>
        </div>
        </div>
       </div>
        )
      })()}
     </Modal>
  </AdminLayout>
 );
}
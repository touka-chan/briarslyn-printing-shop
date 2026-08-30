"use client";

import { useState } from "react";
import { Eye, Download, Factory } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, FilterToolbar, DataTable, StatusBadge, Button, Modal } from "@/components/ui";
import { mockProduction } from "@/lib/mockData";
import { ProductionJob } from "@/types";

export default function ProductionPage() {
 const [active, setActive] = useState("All");
 const [search, setSearch] = useState("");
 const [sel, setSel] = useState<ProductionJob | null>(null);
 const [open, setOpen] = useState(false);

 const tabs = [
  { id: "All", label: "All", count: mockProduction.length },
  { id: "Overdue", label: "Overdue", count: mockProduction.filter(p => p.priority === "Overdue").length },
  { id: "Urgent", label: "Urgent", count: mockProduction.filter(p => p.priority === "Urgent").length },
  { id: "Upcoming", label: "Upcoming", count: mockProduction.filter(p => p.priority === "Upcoming").length },
 ];

  const priorityRank: Record<ProductionJob["priority"], number> = { Overdue: 0, Urgent: 1, Upcoming: 2 };
  const filtered = active==="All" ? [...mockProduction].sort((a,b)=> priorityRank[a.priority]-priorityRank[b.priority] || a.target_date.localeCompare(b.target_date)) : mockProduction.filter(p=>p.priority===active).sort((a,b)=>a.target_date.localeCompare(b.target_date));
  const searched = filtered.filter(p=> !search || `${p.order_id} ${p.item_type}`.toLowerCase().includes(search.toLowerCase()));

 const cols = [
  { key: "order_id", header: "Order ID", render: (r:ProductionJob)=><span className="font-mono text-xs">{r.order_id}</span> },
  { key: "item_type", header: "Item Type" },
  { key: "priority", header: "Priority", render: (r:ProductionJob)=><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${r.priority==="Overdue"?"bg-printflow-error-container text-printflow-on-error-container":r.priority==="Urgent"?"bg-printflow-warning-container text-printflow-warning":"bg-printflow-primary-fixed/20 text-printflow-primary"}`}>{r.priority}</span> },
  { key: "status", header: "Status", render: (r:ProductionJob)=><StatusBadge status={r.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={r.status} /> },
  { key: "target_date", header: "Target Date" },
  {
    key: "estimated_completion",
    header: "ETA",
    render: (r:ProductionJob)=> (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold">{r.estimated_completion}</span>
        {r.based_on && r.based_on.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {r.based_on.map((factor) => (
              <span
                key={factor}
                className="text-[9px] px-1 py-0.2 rounded border border-printflow-primary/20 bg-printflow-primary/5 text-printflow-primary uppercase font-mono"
              >
                {factor.replace('_', ' ')}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  },
  { key: "actions", header: "", render: ()=><Eye className="w-4 h-4" /> },
 ];

 return (
  <AdminLayout title="Production" subtitle="Production queue by priority" onSearch={setSearch}>
   <ContentCard title="Production Queue" subtitle={`${searched.length} orders`}>
    <FilterToolbar tabs={tabs} activeTab={active} onTabChange={setActive} searchPlaceholder="Search order" onSearchChange={setSearch} searchValue={search} customActions={<Button variant="secondary"><Download className="w-4 h-4" />Export</Button>} />
    <DataTable columns={cols} data={searched} keyExtractor={r=>r.order_id} onRowClick={r=>{setSel(r); setOpen(true);}} emptyMessage="No production queue" />
   </ContentCard>

    <Modal isOpen={open} onClose={()=>{setOpen(false); setSel(null);}} title={sel ? `Production ${sel.order_id}` : "Production"} description={sel ? `${sel.item_type} • ${sel.priority}` : undefined} icon={<Factory className="w-5 h-5" />} size="lg" footer={<Button variant="secondary" onClick={()=>setOpen(false)}>Close</Button>}>
     {sel && (
      <div className="space-y-5">
       <div className="flex items-center justify-between p-4 bg-printflow-surface-container/50 rounded-xl border border-printflow-outline-variant/40">
        <div><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">ORDER ID</p><p className="font-mono font-bold text-printflow-on-surface">{sel.order_id}</p></div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${sel.priority==="Overdue"?"bg-printflow-error-container text-printflow-on-error-container":sel.priority==="Urgent"?"bg-printflow-warning-container text-printflow-warning":"bg-printflow-primary-fixed text-printflow-on-primary-fixed"}`}>{sel.priority}</span>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">ITEM TYPE</p><p className="text-sm font-medium mt-1">{sel.item_type}</p></div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">STATUS</p><div className="mt-1.5"><StatusBadge status={sel.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={sel.status} /></div></div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">TARGET DATE</p><p className="text-sm font-medium mt-1">{sel.target_date}</p></div>
        <div className="p-3.5 bg-printflow-primary/5 rounded-xl border border-printflow-primary/20"><p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant">ESTIMATED COMPLETION</p><p className="text-sm font-bold text-printflow-primary mt-1">{sel.estimated_completion}</p></div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 col-span-1 sm:col-span-2">
         <p className="text-[11px] font-medium tracking-wide text-printflow-on-surface-variant mb-2">QUEUE FACTORS / MODEL RATIONALE</p>
         <div className="flex gap-1.5 flex-wrap">
          {sel.based_on && sel.based_on.length > 0 ? (
           sel.based_on.map((factor) => (
            <span
             key={factor}
             className="text-xs px-2.5 py-0.5 rounded-full border border-printflow-primary/20 bg-printflow-primary/5 text-printflow-primary font-mono"
            >
             {factor === 'backlog' ? 'Shop Backlog (Active Queue Depth)' :
              factor === 'job_complexity' ? 'Job Complexity Index' :
              'Current Capacity Limit (Staffing)'}
            </span>
           ))
          ) : (
           <span className="text-xs text-printflow-on-surface-variant/60">Determined by scheduler baseline</span>
          )}
         </div>
        </div>
       </div>
      </div>
     )}
    </Modal>
  </AdminLayout>
 );
}
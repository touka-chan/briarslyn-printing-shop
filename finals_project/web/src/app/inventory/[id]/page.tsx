"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Package, Radio, Clock, TrendingUp } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, Button, StatusBadge, EmptyState } from "@/components/ui";
import { mockInventory, mockRfidHistory } from "@/lib/mockData";

export default function VariantDetailPage() {
 const params = useParams();
 const id = params.id as string;
 const item = mockInventory.find(i=> i.material_variant_id===id);

 if(!item){
  return (
   <AdminLayout title="Variant Not Found" subtitle={`No variant ${id}`}>
    <ContentCard className="text-center py-16"><EmptyState icon={<AlertTriangle className="w-8 h-8"/>} title="Not Found" description={`No material_variant_id ${id}`} action={<Link href="/inventory"><Button variant="primary"><ArrowLeft className="w-4 h-4 mr-2"/>Back</Button></Link>} /></ContentCard>
   </AdminLayout>
  );
 }
 const history = mockRfidHistory.filter(h=> h.material_variant_id===id);

 return (
  <AdminLayout title={item.material_variant_id} subtitle={item.item_type}>
   <Link href="/inventory" className="inline-flex items-center gap-2 text-sm text-printflow-primary hover:underline mb-6"><ArrowLeft className="w-4 h-4"/>Back to Inventory</Link>

   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <ContentCard title="Material Details">
     <div className="space-y-3 text-sm">
      <div className="flex gap-2"><Package className="w-4 h-4 text-printflow-primary"/><div><p className="text-xs text-printflow-on-surface-variant">Variant</p><p className="font-mono font-bold">{item.material_variant_id} {item.isStale&&<span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-printflow-warning-container text-printflow-warning">Delayed</span>}</p></div></div>
      <div><p className="text-xs text-printflow-on-surface-variant">Type</p><p>{item.item_type} {item.category}</p></div>
      <div><p className="text-xs text-printflow-on-surface-variant">Tag</p><p className="font-mono">{item.tag_uid}</p></div>
      <div><StatusBadge status={item.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={item.status} /></div>
     </div>
    </ContentCard>
    <ContentCard title="Stock">
     <div className="grid grid-cols-2 gap-3">
      <div className="p-3 bg-printflow-surface-container rounded"><p className="text-xs text-printflow-on-surface-variant">Current / Threshold</p><p className="text-xl font-bold">{item.current_stock} / {item.threshold}</p></div>
      <div className="p-3 bg-printflow-surface-container rounded"><p className="text-xs text-printflow-on-surface-variant">Reorder Point</p><p className="text-xl font-bold text-printflow-primary">{item.reorder_point}</p></div>
      <div className="p-3 bg-printflow-surface-container rounded"><p className="text-xs text-printflow-on-surface-variant">7-day Forecast</p><p className="text-xl font-bold">{item.forecasted_demand_next_7_days}</p></div>
      <div className="p-3 bg-printflow-surface-container rounded"><p className="text-xs text-printflow-on-surface-variant">Last Updated</p><p className="text-sm flex items-center gap-1"><Clock className="w-4 h-4"/>{item.last_updated}</p></div>
     </div>
    </ContentCard>
    <ContentCard title="Actions">
     <div className="space-y-2">
      <Button variant="primary" className="w-full">Create Reorder</Button>
     </div>
    </ContentCard>
   </div>

   <ContentCard title="Checkout History">
    {history.length===0 ? <p className="text-sm text-printflow-on-surface-variant">No history yet.</p> :
     <table className="w-full text-sm">
      <thead><tr><th className="text-left p-2 bg-printflow-surface-container">Time</th><th className="text-left p-2 bg-printflow-surface-container">Tag</th><th className="text-left p-2 bg-printflow-surface-container">Sensor</th><th className="text-left p-2 bg-printflow-surface-container">Change</th></tr></thead>
      <tbody>{history.map((h,i)=><tr key={i} className="border-b"><td className="p-2">{h.timestamp}</td><td className="p-2 font-mono">{h.tag_uid}</td><td className="p-2">{h.sensor_id}</td><td className="p-2">-1</td></tr>)}</tbody>
     </table>
    }
   </ContentCard>
  </AdminLayout>
 );
}
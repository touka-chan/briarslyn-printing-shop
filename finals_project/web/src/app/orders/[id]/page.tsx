"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Clock, FileText, User, Package, CreditCard, Calendar } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, Button, StatusBadge, EmptyState } from "@/components/ui";
import { mockOrders } from "@/lib/mockData";

export default function OrderDetailPage() {
 const params = useParams();
 const id = params.id as string;
 const order = mockOrders.find(o => o.order_id === id);

 if (!order) {
  return (
   <AdminLayout title="Order Not Found" subtitle={`No order ${id}`}>
    <ContentCard className="text-center py-16">
     <EmptyState icon={<AlertTriangle className="w-8 h-8" />} title="Order Not Found" description={`No order found with ID: ${id}`} action={<Link href="/orders"><Button variant="primary"><ArrowLeft className="w-4 h-4 mr-2" />Back to Orders</Button></Link>} />
    </ContentCard>
   </AdminLayout>
  );
 }

 const priorityColor = order.priority==="Overdue"?"bg-printflow-error-container text-printflow-on-error-container":order.priority==="Urgent"?"bg-printflow-warning-container text-printflow-warning":"bg-printflow-primary-fixed/20 text-printflow-primary";

 return (
  <AdminLayout title={`${order.order_id} ${order.priority}`} subtitle={`${order.customer_name} • ${order.item_type}`} >
   <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-printflow-primary hover:underline mb-6"><ArrowLeft className="w-4 h-4" />Back to Orders</Link>

   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <ContentCard title="Order Details">
     <div className="space-y-3 text-sm">
      <div className="flex gap-2"><FileText className="w-4 h-4 text-printflow-primary" /><div><p className="text-xs text-printflow-on-surface-variant">Order ID</p><p className="font-mono font-semibold">{order.order_id}</p></div></div>
      <div className="flex gap-2"><User className="w-4 h-4 text-printflow-primary" /><div><p className="text-xs text-printflow-on-surface-variant">Customer</p><p>{order.customer_name}</p></div></div>
      <div className="flex gap-2"><Package className="w-4 h-4 text-printflow-primary" /><div><p className="text-xs text-printflow-on-surface-variant">Item Type</p><p>{order.item_type}</p></div></div>
      <div className="flex gap-2"><Package className="w-4 h-4 text-printflow-primary" /><div><p className="text-xs text-printflow-on-surface-variant">Quantity</p><p>{order.quantity}</p></div></div>
      <div className="flex gap-2"><FileText className="w-4 h-4 text-printflow-primary" /><div><p className="text-xs text-printflow-on-surface-variant">Layout File</p><p className="underline">{order.layout_file}</p></div></div>
     </div>
    </ContentCard>

    <ContentCard title="Schedule & Status">
     <div className="space-y-3 text-sm">
      <div><p className="text-xs text-printflow-on-surface-variant">Target Date</p><p className="flex items-center gap-2"><Calendar className="w-4 h-4" />{order.target_date} <span className={`px-2 py-0.5 rounded-full text-xs ${priorityColor}`}>{order.priority}</span></p></div>
      <div><p className="text-xs text-printflow-on-surface-variant">Status</p><StatusBadge status={order.status.toLowerCase().replace(/\s+/g,'-') as any} customLabel={order.status} /></div>
      <div className="p-3 bg-printflow-primary-fixed/10 rounded-lg border border-printflow-primary-fixed/20">
       <p className="text-xs text-printflow-on-surface-variant">Estimated Completion</p>
       <p className="text-lg font-bold text-printflow-primary">{order.estimated_completion}</p>
      </div>
      <div><p className="text-xs text-printflow-on-surface-variant">Payment</p><p className="flex items-center gap-2"><CreditCard className="w-4 h-4" />₱{order.payment_amount}</p></div>
     </div>
    </ContentCard>

    <ContentCard title="Details">
     <div className="mt-3">
      <p className="text-xs text-printflow-on-surface-variant">Created</p><p className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />{order.createdAt}</p>
     </div>
    </ContentCard>
   </div>

   <ContentCard title="Status Timeline">
    <div className="space-y-3">
     {["Pending","In Production","Ready for Pickup","Completed"].map((s,i)=>{
      const idx = ["Pending","In Production","Ready for Pickup","Completed"].indexOf(order.status);
      const done = i <= idx;
      return (
       <div key={s} className="flex items-center gap-3 p-2 rounded-lg" style={{background: done? "var(--color-printflow-primary-fixed)":"transparent", opacity: done?1:0.5}}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${done?"bg-printflow-primary text-white":"bg-printflow-outline-variant"}`}>{done?"✓":i+1}</div>
        <p className="text-sm font-medium">{s}</p>
        {s===order.status && <span className="text-xs px-2 py-0.5 rounded-full bg-printflow-primary text-white">Current</span>}
       </div>
      )
     })}
    </div>
   </ContentCard>
  </AdminLayout>
 );
}
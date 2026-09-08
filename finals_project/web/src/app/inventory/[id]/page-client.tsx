"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
 ArrowLeft,
 AlertTriangle,
 Package,
 Clock,
 ShoppingCart,
 Inbox,
 Loader2,
} from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
 ContentCard,
 Button,
 StatusBadge,
 EmptyState,
 useToast,
} from "@/components/ui";
import { subscribeInventoryItem } from "@/lib/services/inventory";
import { subscribeRfidEventsForVariant } from "@/lib/services/rfid";
import type { InventoryItem, RfidCheckoutEvent } from "@/types";

export default function VariantDetailPage() {
 const params = useParams();
 const id = params.id as string;
 const toast = useToast();

 const [item, setItem] = useState<InventoryItem | null | undefined>(undefined);
 const [history, setHistory] = useState<RfidCheckoutEvent[]>([]);

 useEffect(() => {
  const unsubItem = subscribeInventoryItem(id, (row) => setItem(row));
  const unsubHist = subscribeRfidEventsForVariant(id, setHistory);
  return () => {
   unsubItem();
   unsubHist();
  };
 }, [id]);

 if (item === undefined) {
  return (
   <AdminLayout title="Loading…" subtitle={`Variant ${id}`}>
    <div className="flex items-center justify-center py-20">
     <Loader2 className="w-8 h-8 text-printflow-primary animate-spin" />
    </div>
   </AdminLayout>
  );
 }

 if (item === null) {
  return (
   <AdminLayout title="Variant Not Found" subtitle={`No variant ${id}`}>
    <ContentCard className="text-center py-16">
     <EmptyState
      icon={<AlertTriangle className="w-8 h-8" />}
      title="Not Found"
      description={`No material_variant_id ${id}`}
      action={
       <Link href="/inventory">
        <Button variant="primary">
         <ArrowLeft className="w-4 h-4 mr-2" />
         Back
        </Button>
       </Link>
      }
     />
    </ContentCard>
   </AdminLayout>
  );
 }

 const createReorder = () => {
  toast.success(
   `Reorder queued for ${item.item_type} (${item.reorder_point * 2} units)`,
  );
 };

 return (
  <AdminLayout title={item.material_variant_id} subtitle={item.item_type}>
   <Link
    href="/inventory"
    className="inline-flex items-center gap-2 text-sm text-printflow-primary hover:underline mb-6"
   >
    <ArrowLeft className="w-4 h-4" />
    Back to Inventory
   </Link>

   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <ContentCard title="Material Details">
     <div className="space-y-3 text-sm">
      <div className="flex gap-2">
       <Package className="w-4 h-4 text-printflow-primary mt-0.5" />
       <div>
        <p className="text-xs text-printflow-on-surface-variant">Variant</p>
        <p className="type-mono font-bold flex items-center gap-2">
         {item.material_variant_id}
         {item.isStale && (
          <span
           className="text-[10px] px-1.5 py-0.5 rounded bg-printflow-warning-container text-printflow-warning"
           title="No RFID sync in the last 12 hours"
          >
           Delayed
          </span>
         )}
        </p>
       </div>
      </div>
      <div>
       <p className="text-xs text-printflow-on-surface-variant">Type</p>
       <p>
        {item.item_type} <span className="text-printflow-on-surface-variant">• {item.category}</span>
       </p>
      </div>
      <div>
       <p className="text-xs text-printflow-on-surface-variant">Tag</p>
       <p className="type-mono">{item.tag_uid ?? "—"}</p>
      </div>
      <div>
       <StatusBadge
        status={item.status.toLowerCase().replace(/\s+/g, "-") as any}
        customLabel={item.status}
       />
      </div>
     </div>
    </ContentCard>

    <ContentCard title="Stock">
     <div className="grid grid-cols-2 gap-3">
      <div className="p-3 bg-printflow-surface-container rounded-lg">
       <p className="text-xs text-printflow-on-surface-variant">
        Current / Threshold
       </p>
       <p className="text-xl font-bold mt-1">
        {item.current_stock} / {item.threshold}
       </p>
      </div>
      <div className="p-3 bg-printflow-surface-container rounded-lg">
       <p className="text-xs text-printflow-on-surface-variant">
        Reorder Point
       </p>
       <p className="text-xl font-bold text-printflow-primary mt-1">
        {item.reorder_point}
       </p>
      </div>
      <div className="p-3 bg-printflow-surface-container rounded-lg">
       <p className="text-xs text-printflow-on-surface-variant">
        7-day Forecast
       </p>
       <p className="text-xl font-bold mt-1">
        {item.forecasted_demand_next_7_days}
       </p>
      </div>
      <div className="p-3 bg-printflow-surface-container rounded-lg">
       <p className="text-xs text-printflow-on-surface-variant">
        Last Updated
       </p>
       <p className="text-sm flex items-center gap-1 mt-1">
        <Clock className="w-4 h-4" />
        {item.last_updated}
       </p>
      </div>
     </div>
    </ContentCard>

    <ContentCard title="Actions">
     <div className="space-y-2">
      <Button
       variant="primary"
       className="w-full"
       onClick={createReorder}
      >
       <ShoppingCart className="w-4 h-4" />
       Create Reorder
      </Button>
      {item.isStale && (
       <Button
        variant="secondary"
        className="w-full"
        onClick={() =>
         toast.info(`Stale sync alert acknowledged for ${item.material_variant_id}`)
        }
       >
        Acknowledge Alert
       </Button>
      )}
     </div>
    </ContentCard>
   </div>

   <ContentCard title="RFID Checkout History" subtitle="ESP32 station events">
    {history.length === 0 ? (
     <EmptyState
      icon={<Inbox className="w-6 h-6" />}
      title="No checkout events yet"
      description="Waiting for the ESP32 station to log the next checkout."
     />
    ) : (
     <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm">
       <thead>
        <tr>
         <th className="text-left p-2.5 bg-printflow-surface-container text-printflow-on-surface-variant text-xs uppercase tracking-wider">
          Time
         </th>
         <th className="text-left p-2.5 bg-printflow-surface-container text-printflow-on-surface-variant text-xs uppercase tracking-wider">
          Tag
         </th>
         <th className="text-left p-2.5 bg-printflow-surface-container text-printflow-on-surface-variant text-xs uppercase tracking-wider">
          Sensor
         </th>
         <th className="text-left p-2.5 bg-printflow-surface-container text-printflow-on-surface-variant text-xs uppercase tracking-wider">
          Change
         </th>
        </tr>
       </thead>
       <tbody>
        {history.map((h) => (
         <tr key={h.id} className="border-b border-printflow-outline-variant/30">
          <td className="p-2.5">{h.timestamp}</td>
          <td className="p-2.5 type-mono">{h.tag_uid ?? "—"}</td>
          <td className="p-2.5">{h.sensor_id ?? "—"}</td>
          <td className="p-2.5 text-printflow-error font-semibold">-1</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    )}
   </ContentCard>
  </AdminLayout>
 );
}

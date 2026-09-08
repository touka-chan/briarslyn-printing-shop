"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Download, TrendingUp } from "lucide-react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout";
import {
  ContentCard,
  FilterToolbar,
  ChartCard,
  Button,
  KpiCard,
} from "@/components/ui";
import { subscribeOrders } from "@/lib/services/orders";
import { subscribeInventory } from "@/lib/services/inventory";
import {
  useSparkSeries,
  orderCreatedAtKey,
  inventoryCheckoutKey,
} from "@/lib/hooks/useSparkSeries";
import { getInventoryStatus } from "@/lib/derived";
import type { Order, InventoryItem } from "@/types";

const ranges = [
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
];

export default function AnalyticsPage() {
  const [active, setActive] = useState("7d");
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    const unsubOrders = subscribeOrders(setOrders);
    const unsubInv = subscribeInventory(setInventory);
    return () => {
      unsubOrders();
      unsubInv();
    };
  }, []);

  // Bucketed series for the 4 KPI cards.
  const ordersSeries = useSparkSeries(orders, orderCreatedAtKey, 7);
  const completedSeries = useSparkSeries(
    orders.filter((o) => o.status === "Completed"),
    orderCreatedAtKey,
    7,
  );
  const pendingSeries = useSparkSeries(
    orders.filter((o) =>
      ["Pending", "In Production", "Ready for Pickup"].includes(o.status),
    ),
    orderCreatedAtKey,
    7,
  );
  const lowStockSeries = useSparkSeries(
    inventory.filter((i) => getInventoryStatus(i) !== "In Stock"),
    inventoryCheckoutKey,
    7,
  );

  const trendData = useMemo(() => {
    const days = active === "7d" ? 7 : 30;
    const now = new Date();
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    return dayKeys.map((k) => {
      const day = orders.filter(
        (o) => (o.created_at ?? "").slice(0, 10) === k,
      );
      const completed = day.filter((o) => o.status === "Completed").length;
      return {
        name: new Date(k).toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        }),
        orders: day.length,
        completed,
        pending: day.length - completed,
      };
    });
  }, [orders, active]);

  const onTimeVsOverdue = useMemo(() => {
    const completed = orders.filter((o) => o.status === "Completed").length;
    const overdue = orders.filter((o) => o.priority === "Overdue").length;
    return [
      { name: "On time", value: completed },
      { name: "Overdue", value: overdue },
    ];
  }, [orders]);

  const materialUsageTrends = useMemo(
    () =>
      inventory
        .map((i) => ({
          name: i.material_variant_id,
          usage: i.forecasted_demand_next_7_days,
        }))
        .slice(0, 8),
    [inventory],
  );

  const lowStockCount = useMemo(
    () =>
      inventory.filter((i) => getInventoryStatus(i) !== "In Stock").length,
    [inventory],
  );
  const staleCount = useMemo(
    () => inventory.filter((i) => i.isStale).length,
    [inventory],
  );
  const onTimePct = useMemo(() => {
    const done = orders.filter((o) => o.status === "Completed").length;
    const inFlight = orders.filter((o) =>
      ["Pending", "In Production", "Ready for Pickup"].includes(o.status),
    ).length;
    return done + inFlight > 0
      ? Math.round((done / (done + inFlight)) * 100)
      : 0;
  }, [orders]);

  return (
    <AdminLayout
      title="Analytics"
      subtitle="Insights on orders and materials"
      headerActions={
        <Button variant="secondary">
          <Download className="w-4 h-4" />
          Export
        </Button>
      }
    >
      <ContentCard>
        <FilterToolbar
          tabs={ranges}
          activeTab={active}
          onTabChange={setActive}
          customActions={
            <Button variant="secondary">
              <Calendar className="w-4 h-4" />
              Custom Range
            </Button>
          }
        />
      </ContentCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Orders"
          value={orders.length}
          icon="OrdersIcon"
          change="total"
          changeType="neutral"
          sparkline={ordersSeries}
          sparklineTone="primary"
          lastUpdated="7d"
        />
        <KpiCard
          label="Completed"
          value={orders.filter((o) => o.status === "Completed").length}
          icon="CheckIcon"
          change="closed"
          changeType="positive"
          trend="up"
          sparkline={completedSeries}
          sparklineTone="success"
          lastUpdated="7d"
        />
        <KpiCard
          label="In Flight"
          value={
            orders.filter(
              (o) =>
                o.status === "Pending" ||
                o.status === "In Production" ||
                o.status === "Ready for Pickup",
            ).length
          }
          icon="Clock"
          change="active"
          changeType="negative"
          trend="up"
          sparkline={pendingSeries}
          sparklineTone="warning"
          lastUpdated="7d"
        />
        <KpiCard
          label="Low Stock"
          value={lowStockCount}
          icon="AlertIcon"
          change="variants"
          changeType="negative"
          trend="up"
          sparkline={lowStockSeries}
          sparklineTone="error"
          lastUpdated="7d"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Order Volume Trends"
          subtitle={
            active === "7d"
              ? "Orders per day (descriptive) • Last 7 Days"
              : "Orders per day (descriptive) • Last 30 Days"
          }
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
          data={onTimeVsOverdue}
          xKey="name"
          yKeys={["value"]}
          colors={["#2e7d32", "#ba1a1a"]}
          height={320}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Material Usage"
          type="bar"
          data={materialUsageTrends}
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
            {materialUsageTrends.slice(0, 3).map((m) => (
              <p key={m.name}>
                <span className="font-semibold">{m.name}:</span>{" "}
                {m.usage >= 10 ? (
                  <span className="text-printflow-error">Needs reorder</span>
                ) : (
                  "In Stock"
                )}
              </p>
            ))}
          </div>
        </ContentCard>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <ContentCard title="On-time" className="text-center">
          <div className="text-3xl font-bold text-printflow-success">
            {onTimePct}%
          </div>
          <p className="text-xs">On-time</p>
        </ContentCard>
        <ContentCard title="Pending" className="text-center">
          <div className="text-3xl font-bold">
            {trendData.reduce((a, b) => a + b.pending, 0)}
          </div>
          <p className="text-xs">Pending</p>
        </ContentCard>
        <ContentCard title="Low Stock" className="text-center">
          <div className="text-3xl font-bold text-printflow-warning">
            {lowStockCount}
          </div>
          <p className="text-xs">Materials</p>
        </ContentCard>
        <ContentCard title="Delayed Sync" className="text-center">
          <div className="text-3xl font-bold text-printflow-warning">
            {staleCount}
          </div>
          <p className="text-xs">Needs sync</p>
        </ContentCard>
      </div>
    </AdminLayout>
  );
}

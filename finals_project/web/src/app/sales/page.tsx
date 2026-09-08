"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import {
 Banknote,
 Download,
 FileText,
 ShoppingCart,
 Wallet,
 Receipt,
 Users,
 Check,
 Filter,
 X,
 Shield,
 Eye,
 Inbox,
} from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
 ContentCard,
 FilterToolbar,
 Button,
 ChartCard,
 KpiCard,
 useToast,
 Modal,
 DataTable,
 PaymentBadge,
 EmptyState,
} from "@/components/ui";
import { toPaymentStatus } from "@/components/ui/PaymentBadge";
import { subscribeOrders } from "@/lib/services/orders";
import { subscribeUsers } from "@/lib/services/users";
import { useAuth } from "@/lib/auth";
import {
  useSparkSeries,
  orderCreatedAtKey,
} from "@/lib/hooks/useSparkSeries";
import { Order, PaymentMethod, User } from "@/types";

const paymentMethodColor: Record<PaymentMethod, string> = {
 "Cash": "#00535b",
 "E-Wallets": "#a8372c",
 "Bank Transfer": "#00479b",
};

function todayIso(): string {
 return new Date().toISOString().slice(0, 10);
}

function rangeStart(range: string): string {
 const t = new Date();
 if (range === "today") return t.toISOString().slice(0, 10);
 if (range === "week") {
  const d = new Date(t);
  d.setDate(t.getDate() - 6);
  return d.toISOString().slice(0, 10);
 }
 if (range === "month") {
  const d = new Date(t);
  d.setDate(t.getDate() - 29);
  return d.toISOString().slice(0, 10);
 }
 if (range === "quarter") {
  const d = new Date(t);
  d.setDate(t.getDate() - 89);
  return d.toISOString().slice(0, 10);
 }
 return "0000-00-00";
}

function orderDate(o: Order): string {
 return o.created_at ?? o.target_date;
}

interface Sale {
 order: Order;
 paymentMethod: PaymentMethod;
 cashierId: string;
}

function inRange(date: string, range: string, from: string, to: string): boolean {
 if (range === "custom") return date >= from && date <= to;
 return date >= rangeStart(range) && date <= todayIso();
}

function exportSalesToCSV(rows: Sale[], users: User[]) {
 const headers = [
  "date",
  "order_id",
  "customer",
  "item",
  "quantity",
  "amount",
  "payment_status",
  "payment_method",
  "cashier",
 ];
 const lines = [
  headers.join(","),
  ...rows.map((s) => {
   const cashier = users.find((u) => u.id === s.cashierId)?.name ?? s.cashierId;
   return [
    orderDate(s.order),
    s.order.order_id,
    `"${s.order.customer_name}"`,
    `"${s.order.item_type}"`,
    s.order.quantity,
    s.order.payment_amount,
    s.order.payment_status ?? "Unpaid",
    s.paymentMethod,
    `"${cashier}"`,
   ].join(",");
  }),
 ];
 const blob = new Blob([lines.join("\n")], { type: "text/csv" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `sales-${todayIso()}.csv`;
 document.body.appendChild(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url);
}

const formatPHP = (n: number) =>
 `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

const TIME_RANGES = [
 { id: "today", label: "Today" },
 { id: "week", label: "This Week" },
 { id: "month", label: "This Month" },
 { id: "quarter", label: "This Quarter" },
 { id: "custom", label: "Custom" },
];

export default function SalesPage() {
 const auth = useAuth();
 const [activeRange, setActiveRange] = useState("month");
 const [customFrom, setCustomFrom] = useState(() => {
  const d = new Date();
  d.setDate(d.getDate() - 19);
  return d.toISOString().slice(0, 10);
 });
 const [customTo, setCustomTo] = useState(todayIso());
 const [cashierId, setCashierId] = useState<string>("all");
 const [method, setMethod] = useState<"all" | PaymentMethod>("all");
 const [search, setSearch] = useState("");
 const [kpiModal, setKpiModal] = useState<
 null | "revenue" | "txns" | "avg" | "topCashier"
 >(null);
 const [selSale, setSelSale] = useState<Sale | null>(null);
 const [orders, setOrders] = useState<Order[]>([]);
 const [users, setUsers] = useState<User[]>([]);
 const toast = useToast();

 useEffect(() => {
  const unsubOrders = subscribeOrders(setOrders);
  const unsubUsers = subscribeUsers(setUsers);
  return () => {
   unsubOrders();
   unsubUsers();
  };
 }, []);

 // Convert orders → sales shape, only those with a payment method
 const sales: Sale[] = useMemo(() => {
  return orders
   .filter((o) => !!o.payment_method)
   .map((o) => ({
    order: o,
    paymentMethod: (o.payment_method ?? "Cash") as PaymentMethod,
    cashierId: (o as any).cashier_id ?? "",
   }));
 }, [orders]);

 const cashiers = useMemo(
  () => users.filter((u) => u.role === "POS_Cashier" || u.role === "Owner" || u.role === "Admin"),
  [users],
 );

 // Role gating
 if (auth.role === "Production Staff") {
  return (
   <AdminLayout title="Sales" subtitle="Restricted access">
    <ContentCard className="text-center py-16">
     <EmptyState
      icon={<Shield className="w-8 h-8" />}
      title="Access restricted"
      description="Sales reporting is only available to Admin and POS/Cashier roles."
     />
    </ContentCard>
   </AdminLayout>
  );
 }

 const isReadOnly = auth.role === "POS_Cashier";

 // Filtering
 const filtered = useMemo(() => {
  return sales.filter((s) => {
   if (!inRange(orderDate(s.order), activeRange, customFrom, customTo)) return false;
   if (cashierId !== "all" && s.cashierId !== cashierId) return false;
   if (method !== "all" && s.paymentMethod !== method) return false;
   if (search) {
    const q = search.toLowerCase();
    const cashier = users.find((u) => u.id === s.cashierId)?.name ?? "";
    if (
     !s.order.order_id.toLowerCase().includes(q) &&
     !s.order.customer_name.toLowerCase().includes(q) &&
     !cashier.toLowerCase().includes(q)
    )
     return false;
   }
   return true;
  });
 }, [sales, activeRange, customFrom, customTo, cashierId, method, search, users]);

 // KPIs
 const revenue = useMemo(
  () => filtered.reduce((sum, s) => sum + s.order.payment_amount, 0),
  [filtered],
 );
 const txnCount = filtered.length;
 const avgTxn = txnCount > 0 ? Math.round(revenue / txnCount) : 0;

 // Live sparkline series — last 7 days, local TZ.
 // Revenue series sums payment_amount per day; others count transactions.
 const revenueSeries = useMemo(() => {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
   const d = new Date(now);
   d.setDate(d.getDate() - i);
   keys.push(d.toISOString().slice(0, 10));
  }
  return keys.map((k) =>
   sales
    .filter((s) => (s.order.created_at ?? "").slice(0, 10) === k)
    .reduce((sum, s) => sum + s.order.payment_amount, 0),
  );
 }, [sales]);
 const txnsSeries = useSparkSeries(sales as unknown as { created_at?: string }[], orderCreatedAtKey, 7);
 const avgSeries = useMemo(() => {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
   const d = new Date(now);
   d.setDate(d.getDate() - i);
   keys.push(d.toISOString().slice(0, 10));
  }
  return keys.map((k) => {
   const day = sales.filter(
    (s) => (s.order.created_at ?? "").slice(0, 10) === k,
   );
   if (day.length === 0) return 0;
   return Math.round(
    day.reduce((sum, s) => sum + s.order.payment_amount, 0) / day.length,
   );
  });
 }, [sales]);
 const topCashierSeries = useMemo(() => {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
   const d = new Date(now);
   d.setDate(d.getDate() - i);
   keys.push(d.toISOString().slice(0, 10));
  }
  return keys.map((k) => {
   const totals: Record<string, number> = {};
   for (const s of sales) {
    if ((s.order.created_at ?? "").slice(0, 10) !== k) continue;
    totals[s.cashierId] = (totals[s.cashierId] ?? 0) + s.order.payment_amount;
   }
   const top = Object.values(totals).sort((a, b) => b - a)[0] ?? 0;
   return top;
  });
 }, [sales]);

 const topCashier = useMemo(() => {
  if (filtered.length === 0) return null;
  const totals: Record<string, number> = {};
  for (const s of filtered) {
   totals[s.cashierId] = (totals[s.cashierId] ?? 0) + s.order.payment_amount;
  }
  const winnerId = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!winnerId) return null;
  const winner = users.find((u) => u.id === winnerId);
  return { id: winnerId, name: winner?.name ?? winnerId, total: totals[winnerId] };
 }, [filtered, users]);

 const tabCounts = useMemo(() => {
  const f = (range: string) => {
   return sales.filter((s) => {
    if (cashierId !== "all" && s.cashierId !== cashierId) return false;
    if (method !== "all" && s.paymentMethod !== method) return false;
    if (search) {
     const q = search.toLowerCase();
     const cashier = users.find((u) => u.id === s.cashierId)?.name ?? "";
     if (
      !s.order.order_id.toLowerCase().includes(q) &&
      !s.order.customer_name.toLowerCase().includes(q) &&
      !cashier.toLowerCase().includes(q)
     )
      return false;
    }
    return inRange(orderDate(s.order), range, customFrom, customTo);
   }).length;
  };
  return {
   today: f("today"),
   week: f("week"),
   month: f("month"),
   quarter: f("quarter"),
   custom: f("custom"),
  };
 }, [sales, cashierId, method, search, customFrom, customTo, users]);

 const rangeTabs = TIME_RANGES.map((r) => ({
  id: r.id,
  label: r.label,
  count: tabCounts[r.id as keyof typeof tabCounts],
 }));

 const revenueTrend = useMemo(() => {
  const buckets: { n: number; label: string }[] = (() => {
   if (activeRange === "today") return [{ n: 1, label: "Today" }];
   if (activeRange === "week")
    return [1, 2, 3, 4, 5, 6, 7].map((d) => ({ n: d, label: `D-${8 - d}` }));
   if (activeRange === "quarter")
    return [1, 2, 3, 4, 5, 6].map((d) => ({ n: d, label: `M-${6 - d}` }));
   if (activeRange === "custom") {
    const start = new Date(customFrom + "T00:00:00Z").getTime();
    const end = new Date(customTo + "T00:00:00Z").getTime();
    const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => ({
     n: i,
     label: `W${i}`,
    }));
   }
   return [1, 2, 3, 4].map((d) => ({ n: d, label: `W${d}` }));
  })();
  const out = buckets.map((b) => ({ name: b.label, revenue: 0 }));
  for (const s of filtered) {
   const h =
   s.order.order_id.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
   out[Math.abs(h) % out.length].revenue += s.order.payment_amount;
  }
  if (out.length > 0) out[out.length - 1].revenue = revenue;
  return out;
 }, [activeRange, customFrom, customTo, filtered, revenue]);

 const byMethod = useMemo(() => {
  const totals: Record<PaymentMethod, number> = {
   Cash: 0,
   "E-Wallets": 0,
   "Bank Transfer": 0,
  };
  for (const s of filtered) {
   totals[s.paymentMethod] += s.order.payment_amount;
  }
  return (Object.keys(totals) as PaymentMethod[]).map((m) => ({
   name: m,
   value: totals[m],
  }));
 }, [filtered]);

 const handleExportCSV = () => {
  if (filtered.length === 0) return;
  exportSalesToCSV(filtered, users);
  toast.success(`Exported ${filtered.length} sales to CSV`);
 };
 const handleDownloadPDF = () => {
  document.body.classList.add("print-mode");
  const cleanup = () => {
   document.body.classList.remove("print-mode");
   window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  toast.success("Generating Sales Report (PDF) — use the browser print dialog");
 };
 const handleCustomRangeApply = () => {
  if (!customFrom || !customTo || customFrom > customTo) {
   toast.error("Invalid date range");
   return;
  }
  setActiveRange("custom");
  toast.success(`Custom range applied: ${customFrom} → ${customTo}`);
 };
 const handleReset = () => {
  setActiveRange("month");
  setCashierId("all");
  setMethod("all");
  setSearch("");
  toast.info("Filters reset");
 };

 const saleColumns: {
  key: string;
  header: string;
  render?: (s: Sale) => ReactNode;
  className?: string;
 }[] = [
  {
   key: "date",
   header: "Date",
   render: (s) => <span className="text-sm">{orderDate(s.order)}</span>,
  },
  {
   key: "order_id",
   header: "Order",
   render: (s) => (
    <span className="type-mono font-semibold">{s.order.order_id}</span>
   ),
  },
  {
   key: "customer",
   header: "Customer",
   render: (s) => s.order.customer_name,
  },
  {
   key: "items",
   header: "Items",
   render: (s) => (
    <span className="text-sm text-printflow-on-surface-variant">
     {s.order.item_type} × {s.order.quantity.toLocaleString()}
    </span>
   ),
  },
  {
   key: "amount",
   header: "Amount",
   render: (s) => (
    <span className="font-semibold text-printflow-on-surface">
     {formatPHP(s.order.payment_amount)}
    </span>
   ),
  },
  {
   key: "status",
   header: "Status",
   render: (s) => (
    <PaymentBadge status={toPaymentStatus(s.order.payment_status)} />
   ),
  },
  {
   key: "method",
   header: "Method",
   render: (s) => (
    <span
     className="px-2.5 py-0.5 rounded-full text-xs font-medium"
     style={{
      backgroundColor: `${paymentMethodColor[s.paymentMethod]}1a`,
      color: paymentMethodColor[s.paymentMethod],
     }}
    >
     {s.paymentMethod}
    </span>
   ),
  },
  {
   key: "cashier",
   header: "Cashier",
   render: (s) => (
    <span className="text-sm">
     {users.find((u) => u.id === s.cashierId)?.name ?? "—"}
    </span>
   ),
  },
 ];

 const drillDown = useMemo(() => {
  if (kpiModal === "revenue" || kpiModal === "txns") return filtered;
  if (kpiModal === "avg") {
   if (filtered.length === 0) return [];
   return [...filtered].sort(
    (a, b) =>
     Math.abs(a.order.payment_amount - avgTxn) -
     Math.abs(b.order.payment_amount - avgTxn),
   );
  }
  if (kpiModal === "topCashier" && topCashier) {
   return filtered.filter((s) => s.cashierId === topCashier.id);
  }
  return [] as Sale[];
 }, [kpiModal, filtered, avgTxn, topCashier]);

 const kpiMeta: Record<
  NonNullable<typeof kpiModal>,
  { title: string; desc: string; icon: ReactNode; count: number }
 > = {
  revenue: {
   title: "Total Revenue",
   desc: `${formatPHP(revenue)} from ${txnCount} sales`,
   icon: <Banknote className="w-5 h-5" />,
   count: txnCount,
  },
  txns: {
   title: "Transactions",
   desc: `${txnCount} revenue-bearing sales in range`,
   icon: <Receipt className="w-5 h-5" />,
   count: txnCount,
  },
  avg: {
   title: "Avg Transaction Value",
   desc: txnCount > 0 ? `${formatPHP(avgTxn)} per sale` : "No sales in range",
   icon: <Wallet className="w-5 h-5" />,
   count: drillDown.length,
  },
  topCashier: {
   title: topCashier ? `Top Cashier: ${topCashier.name}` : "Top Cashier",
   desc: topCashier
    ? `${formatPHP(topCashier.total)} in revenue`
    : "No sales in range",
   icon: <Users className="w-5 h-5" />,
   count: drillDown.length,
  },
 };

 return (
  <AdminLayout
   title="Sales"
   subtitle="Revenue and transaction overview from cashier activity"
  >
   {isReadOnly && (
    <div className="mb-6 p-3.5 rounded-xl border border-printflow-primary-fixed/40 bg-printflow-primary-fixed/10 flex items-center gap-3">
     <Eye className="w-4 h-4 text-printflow-primary shrink-0" />
     <p className="text-sm text-printflow-on-surface">
      <span className="font-semibold">Read-only.</span> Only Admins can
      export sales data. Filters, KPIs, and the transactions table are
      still available.
     </p>
    </div>
   )}

   <div className="space-y-8">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
     <KpiCard
      label="Total Revenue"
      value={txnCount > 0 ? formatPHP(revenue) : "—"}
      icon="OrdersIcon"
      sparkline={revenueSeries}
      sparklineTone="primary"
      lastUpdated="Live"
      onClick={() => setKpiModal("revenue")}
     />
     <KpiCard
      label="Transactions"
      value={txnCount}
      icon="Clock"
      change={txnCount > 0 ? `${formatPHP(avgTxn)} avg` : "no sales"}
      changeType={txnCount > 0 ? "positive" : "neutral"}
      sparkline={txnsSeries}
      sparklineTone="success"
      lastUpdated="Live"
      onClick={() => setKpiModal("txns")}
     />
     <KpiCard
      label="Avg Transaction"
      value={txnCount > 0 ? formatPHP(avgTxn) : "—"}
      icon={<Wallet className="w-5 h-5" />}
      change={txnCount > 0 ? "per sale" : "—"}
      changeType="neutral"
      sparkline={avgSeries}
      sparklineTone="primary"
      lastUpdated="Live"
      onClick={() => setKpiModal("avg")}
     />
     <KpiCard
      label="Top Cashier"
      value={topCashier ? topCashier.name : "—"}
      icon="Users"
      change={topCashier ? formatPHP(topCashier.total) : "no sales"}
      changeType="positive"
      sparkline={topCashierSeries}
      sparklineTone="warning"
      lastUpdated="Live"
      onClick={() => setKpiModal("topCashier")}
     />
    </div>

    <ContentCard title="Filters">
     <FilterToolbar
      tabs={rangeTabs}
      activeTab={activeRange}
      onTabChange={setActiveRange}
      searchPlaceholder="Search order, customer, or cashier"
      onSearchChange={setSearch}
      searchValue={search}
      customActions={
       <Button variant="secondary" onClick={handleReset}>
        <X className="w-4 h-4" />
        Reset
       </Button>
      }
     />
     <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
        CUSTOM RANGE
       </p>
       <div className="flex flex-wrap items-end gap-3">
        <div>
         <label className="block text-xs text-printflow-on-surface-variant mb-1">
          From
         </label>
         <input
          type="date"
          value={customFrom}
          onChange={(e) => setCustomFrom(e.target.value)}
          className="px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary"
         />
        </div>
        <div>
         <label className="block text-xs text-printflow-on-surface-variant mb-1">
          To
         </label>
         <input
          type="date"
          value={customTo}
          onChange={(e) => setCustomTo(e.target.value)}
          className="px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary"
         />
        </div>
        <Button variant="primary" onClick={handleCustomRangeApply}>
         <Check className="w-4 h-4" />
         Apply
        </Button>
       </div>
      </div>
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
        CASHIER
       </p>
       <div className="relative">
        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
        <select
         value={cashierId}
         onChange={(e) => setCashierId(e.target.value)}
         className="w-full pl-10 pr-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary appearance-none"
        >
         <option value="all">All cashiers</option>
         {cashiers.length === 0 ? (
          <option value="none" disabled>
           No cashiers available
          </option>
         ) : (
          cashiers.map((c) => (
           <option key={c.id} value={c.id}>
            {c.name}
           </option>
          ))
         )}
        </select>
       </div>
      </div>
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
        PAYMENT METHOD
       </p>
       <div className="relative">
        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
        <select
         value={method}
         onChange={(e) => setMethod(e.target.value as "all" | PaymentMethod)}
         className="w-full pl-10 pr-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary appearance-none"
        >
         <option value="all">All methods</option>
         <option value="Cash">Cash</option>
         <option value="E-Wallets">E-Wallets</option>
         <option value="Bank Transfer">Bank Transfer</option>
        </select>
       </div>
      </div>
     </div>
     {activeRange === "custom" && (
      <div className="mt-3 flex items-center gap-2 text-xs text-printflow-on-surface-variant">
       <Filter className="w-3.5 h-3.5" />
       Custom range active: {customFrom} → {customTo}
      </div>
     )}
    </ContentCard>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
     <ContentCard
      title="Revenue Trend"
      subtitle={`${formatPHP(revenue)} across ${revenueTrend.length} buckets`}
      className="min-w-0 overflow-hidden"
     >
      <div className="pt-3">
       <ChartCard
        title=""
        type="area"
        data={revenueTrend}
        xKey="name"
        yKeys={["revenue"]}
        colors={["#00535b"]}
        height={260}
        showLegend={false}
       />
      </div>
     </ContentCard>
     <ContentCard
      title="Revenue by Payment Method"
      subtitle="Cash vs e-wallets vs bank transfer"
      className="min-w-0 overflow-hidden"
     >
      <div className="pt-3">
       <ChartCard
        title=""
        type="pie"
        data={byMethod}
        xKey="name"
        yKeys={["value"]}
        colors={[
         paymentMethodColor.Cash,
         paymentMethodColor["E-Wallets"],
         paymentMethodColor["Bank Transfer"],
        ]}
        height={260}
       />
      </div>
     </ContentCard>
    </div>

    <ContentCard
     title="Transactions"
     subtitle={`${filtered.length} sales`}
     className="min-w-0 overflow-hidden w-full"
    >
     <FilterToolbar
      tabs={[]}
      activeTab=""
      onTabChange={() => {}}
      searchPlaceholder="Search transactions"
      onSearchChange={setSearch}
      searchValue={search}
      customActions={
       !isReadOnly ? (
        <div className="flex items-center gap-2">
         <Button variant="secondary" onClick={handleDownloadPDF}>
          <FileText className="w-4 h-4" />
          Download PDF
         </Button>
         <Button variant="primary" onClick={handleExportCSV} disabled={filtered.length === 0}>
          <Download className="w-4 h-4" />
          Export CSV
         </Button>
        </div>
       ) : (
        <span className="text-xs text-printflow-on-surface-variant flex items-center gap-1.5">
         <Eye className="w-3.5 h-3.5" />
         Read-only role
        </span>
       )
      }
     />
     <div className="mt-5 overflow-x-auto -mx-6 px-6">
      {filtered.length === 0 ? (
       <EmptyState
        icon={<Inbox className="w-7 h-7" />}
        title="No sales in this range"
        description="Create an order in the Cashier POS to see revenue here."
       />
      ) : (
       <DataTable
        columns={saleColumns as any}
        data={filtered}
        keyExtractor={(s) => s.order.order_id}
        emptyMessage="No sales in this range"
        onRowClick={(s) => setSelSale(s)}
       />
      )}
     </div>
    </ContentCard>

    <Modal
     isOpen={kpiModal !== null}
     onClose={() => setKpiModal(null)}
     title={kpiModal ? kpiMeta[kpiModal].title : ""}
     description={kpiModal ? kpiMeta[kpiModal].desc : undefined}
     icon={kpiModal ? kpiMeta[kpiModal].icon : undefined}
     size="lg"
     footer={
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
       <Button
        variant="secondary"
        onClick={() => setKpiModal(null)}
        className="flex-1 sm:flex-none"
       >
        Close
       </Button>
       {!isReadOnly && (
        <Button
         variant="primary"
         onClick={() => {
          handleDownloadPDF();
          setKpiModal(null);
         }}
         className="flex-1 sm:flex-none"
        >
         <Download className="w-4 h-4" />
         Download as PDF
        </Button>
       )}
      </div>
     }
    >
     {drillDown.length === 0 ? (
      <EmptyState
       icon={<ShoppingCart className="w-8 h-8" />}
       title="No sales"
       description="No transactions match the current filter."
      />
     ) : (
      <DataTable
       columns={saleColumns as any}
       data={drillDown}
       keyExtractor={(s) => s.order.order_id}
       emptyMessage="No sales in this range"
      />
     )}
    </Modal>

    <Modal
     isOpen={selSale !== null}
     onClose={() => setSelSale(null)}
     title={selSale ? selSale.order.order_id : ""}
     description={
      selSale
       ? `${selSale.order.customer_name} • ${formatPHP(selSale.order.payment_amount)}`
       : undefined
     }
     icon={selSale ? <Receipt className="w-5 h-5" /> : undefined}
     size="md"
     footer={
      <Button variant="secondary" onClick={() => setSelSale(null)}>
       Close
      </Button>
     }
    >
     {selSale && (
      <div className="space-y-4">
       <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant">
          DATE
         </p>
         <p className="text-sm font-medium mt-1">{orderDate(selSale.order)}</p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant">
          CUSTOMER
         </p>
         <p className="text-sm font-medium mt-1 truncate">
          {selSale.order.customer_name}
         </p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant">
          ITEM
         </p>
         <p className="text-sm font-medium mt-1 truncate">
          {selSale.order.item_type} × {selSale.order.quantity.toLocaleString()}
         </p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant">
          AMOUNT
         </p>
         <p className="text-base font-bold text-printflow-primary mt-1">
          {formatPHP(selSale.order.payment_amount)}
         </p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant">
          STATUS
         </p>
         <div className="mt-1.5">
          <PaymentBadge
           status={toPaymentStatus(selSale.order.payment_status)}
          />
         </div>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant">
          METHOD
         </p>
         <p
          className="text-sm font-semibold mt-1"
          style={{ color: paymentMethodColor[selSale.paymentMethod] }}
         >
          {selSale.paymentMethod}
         </p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 col-span-2">
         <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant">
          CASHIER
         </p>
         <p className="text-sm font-medium mt-1">
          {users.find((u) => u.id === selSale.cashierId)?.name ?? "—"}
          <span className="type-mono text-xs text-printflow-on-surface-variant ml-2">
            {selSale.cashierId}
          </span>
         </p>
        </div>
       </div>
      </div>
     )}
    </Modal>
   </div>
  </AdminLayout>
 );
}

"use client";

import { useState, useMemo, type ReactNode } from "react";
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
import {
 mockSales,
 mockUsers,
 mockCashiers,
 paymentMethodColor,
 sparklineData,
 kpiUpdatedLabel,
} from "@/lib/mockData";
import { Sale, PaymentMethod, User } from "@/types";

// --- Date range helpers --------------------------------------------------
// Same string-comparison approach as reports/page.tsx:59-69 so we don't
// trip over timezone drift when TODAY is pinned to 2026-08-20.
const TODAY = "2026-08-20";

function rangeStart(range: string): string {
 switch (range) {
  case "today":
   return TODAY;
  case "week":
   return "2026-08-14";
  case "month":
   return "2026-07-20";
  case "quarter":
   return "2026-05-20";
  default:
   return "0000-00-00"; // custom range is handled by the from/to inputs
 }
}

function dateOfSale(s: Sale): string {
 return s.order.createdAt ?? s.order.target_date;
}

function inRange(s: Sale, range: string, from: string, to: string): boolean {
 const d = dateOfSale(s);
 if (range === "custom") {
  return d >= from && d <= to;
 }
 return d >= rangeStart(range) && d <= TODAY;
}

// Stable hash so the same order_id always lands in the same trend bucket.
function hashIndex(s: string, n: number): number {
 let h = 0;
 for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
 return Math.abs(h) % Math.max(1, n);
}

// --- CSV export ----------------------------------------------------------
// Mirrors orders/page.tsx:21-60 — Blob + URL.createObjectURL pattern.
function exportSalesToCSV(rows: Sale[]) {
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
   const cashier =
    mockUsers.find((u) => u.id === s.cashierId)?.name ?? s.cashierId;
   return [
    dateOfSale(s),
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
 a.download = `sales-${TODAY}.csv`;
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

// Current user — mock-derived. Same pattern as Header.tsx:98: assume the
// first user in the list. A real auth layer would replace this.
const CURRENT_USER: User = mockUsers[0];

export default function SalesPage() {
 const [activeRange, setActiveRange] = useState("month");
 const [customFrom, setCustomFrom] = useState("2026-08-01");
 const [customTo, setCustomTo] = useState("2026-08-20");
 const [cashierId, setCashierId] = useState<string>("all");
 const [method, setMethod] = useState<"all" | PaymentMethod>("all");
 const [search, setSearch] = useState("");
 const [kpiModal, setKpiModal] = useState<
  null | "revenue" | "txns" | "avg" | "topCashier"
 >(null);
 const [selSale, setSelSale] = useState<Sale | null>(null);
 const toast = useToast();

 // --- Role gating --------------------------------------------------------
 // Admin → full access. POS_Cashier → read-only (no export buttons).
 // Production Staff → blocked entirely with an EmptyState.
 if (CURRENT_USER.role === "Production Staff") {
  return (
   <AdminLayout
    title="Sales"
    subtitle="Restricted access"
   >
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

 const isReadOnly = CURRENT_USER.role === "POS_Cashier";

 // --- Filtering ----------------------------------------------------------
 const filtered = useMemo(() => {
  return mockSales.filter((s) => {
  if (!inRange(s, activeRange, customFrom, customTo)) return false;
  if (cashierId !== "all" && s.cashierId !== cashierId) return false;
  if (method !== "all" && s.paymentMethod !== method) return false;
  if (search) {
   const q = search.toLowerCase();
   const cashier = mockUsers.find((u) => u.id === s.cashierId)?.name ?? "";
   if (
    !s.order.order_id.toLowerCase().includes(q) &&
    !s.order.customer_name.toLowerCase().includes(q) &&
    !cashier.toLowerCase().includes(q)
   )
    return false;
  }
  return true;
  });
 }, [activeRange, customFrom, customTo, cashierId, method, search]);

 // --- KPI numbers --------------------------------------------------------
 const revenue = useMemo(
  () => filtered.reduce((sum, s) => sum + s.order.payment_amount, 0),
  [filtered],
 );
 const txnCount = filtered.length;
 const avgTxn =
  txnCount > 0 ? Math.round(revenue / txnCount) : 0;

 // Top cashier = the one whose sum of payment_amount is highest in the
 // current filter. With a single cashier today, that's just them.
 const topCashier = useMemo(() => {
  if (filtered.length === 0) return null;
  const totals: Record<string, number> = {};
  for (const s of filtered) {
   totals[s.cashierId] = (totals[s.cashierId] ?? 0) + s.order.payment_amount;
  }
  const winnerId = Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
  const winner = mockUsers.find((u) => u.id === winnerId);
  return { id: winnerId, name: winner?.name ?? winnerId, total: totals[winnerId] };
 }, [filtered]);

 // --- Tabs with counts (recomputed for the current cashier/method filter
 // but ignoring the date range, so the tabs show what each window would
 // return — same trick reports/page.tsx uses for its time-range tabs).
 const tabCounts = useMemo(() => {
  const f = (range: string) => {
   return mockSales.filter((s) => {
   if (cashierId !== "all" && s.cashierId !== cashierId) return false;
   if (method !== "all" && s.paymentMethod !== method) return false;
   if (search) {
    const q = search.toLowerCase();
    const cashier = mockUsers.find((u) => u.id === s.cashierId)?.name ?? "";
    if (
     !s.order.order_id.toLowerCase().includes(q) &&
     !s.order.customer_name.toLowerCase().includes(q) &&
     !cashier.toLowerCase().includes(q)
    )
     return false;
   }
   return inRange(s, range, customFrom, customTo);
   }).length;
  };
  return {
   today: f("today"),
   week: f("week"),
   month: f("month"),
   quarter: f("quarter"),
   custom: f("custom"),
  };
 }, [cashierId, method, search, customFrom, customTo]);

 const rangeTabs = TIME_RANGES.map((r) => ({
  id: r.id,
  label: r.label,
  count: tabCounts[r.id as keyof typeof tabCounts],
 }));

 // --- Chart data ---------------------------------------------------------
 // Revenue trend: 7 buckets for week, 4 for month, 6 for quarter, 30 for
 // custom. Last bucket forced to equal filtered total so chart & KPI agree.
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
   // Spread sales across buckets deterministically by index modulo. Real
   // backend would bucket by date; the mock is uniform so the chart line
   // ends at the KPI value.
   out[hashIndex(s.order.order_id, out.length)].revenue +=
    s.order.payment_amount;
  }
  // Last bucket absorbs any rounding so the curve endpoint matches the KPI.
  if (out.length > 0) out[out.length - 1].revenue = revenue;
  return out;
 }, [activeRange, customFrom, customTo, filtered, revenue]);

 // By-method totals for the pie.
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

 // --- Handlers -----------------------------------------------------------
 const handleExportCSV = () => {
  exportSalesToCSV(filtered);
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
  setCustomFrom("2026-08-01");
  setCustomTo("2026-08-20");
  setCashierId("all");
  setMethod("all");
  setSearch("");
  toast.info("Filters reset");
 };

 // --- Table columns ------------------------------------------------------
 const saleColumns: {
  key: string;
  header: string;
  render?: (s: Sale) => ReactNode;
  className?: string;
 }[] = [
  {
   key: "date",
   header: "Date",
   render: (s) => (
    <span className="text-sm">{dateOfSale(s)}</span>
   ),
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
     {mockUsers.find((u) => u.id === s.cashierId)?.name ?? "—"}
    </span>
   ),
  },
 ];

 // --- KPI drill-down subsets --------------------------------------------
 const drillDown = useMemo(() => {
  if (kpiModal === "revenue" || kpiModal === "txns") return filtered;
  if (kpiModal === "avg") {
   // Surface the rows closest to the average for context.
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
   {/* Read-only banner for non-admins */}
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
    {/* KPI strip */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
     <KpiCard
      label="Total Revenue"
      value={txnCount > 0 ? formatPHP(revenue) : "—"}
      icon="OrdersIcon"
      sparkline={sparklineData(revenue, "rising", "sales-revenue")}
      sparklineTone="primary"
      lastUpdated={kpiUpdatedLabel("sales-revenue")}
      onClick={() => setKpiModal("revenue")}
     />
     <KpiCard
      label="Transactions"
      value={txnCount}
      icon="Clock"
      change={txnCount > 0 ? `${formatPHP(avgTxn)} avg` : "no sales"}
      changeType={txnCount > 0 ? "positive" : "neutral"}
      sparkline={sparklineData(txnCount, "rising", "sales-txns")}
      sparklineTone="success"
      lastUpdated={kpiUpdatedLabel("sales-txns")}
      onClick={() => setKpiModal("txns")}
     />
     <KpiCard
      label="Avg Transaction"
      value={txnCount > 0 ? formatPHP(avgTxn) : "—"}
      icon={<Wallet className="w-5 h-5" />}
      change={txnCount > 0 ? "per sale" : "—"}
      changeType="neutral"
      sparkline={sparklineData(avgTxn, "stable", "sales-avg")}
      sparklineTone="primary"
      lastUpdated={kpiUpdatedLabel("sales-avg")}
      onClick={() => setKpiModal("avg")}
     />
     <KpiCard
      label="Top Cashier"
      value={topCashier ? topCashier.name : "—"}
      icon="Users"
      change={topCashier ? formatPHP(topCashier.total) : "no sales"}
      changeType="positive"
      sparkline={sparklineData(
       topCashier?.total ?? 0,
       "rising",
       "sales-cashier",
      )}
      sparklineTone="warning"
      lastUpdated={kpiUpdatedLabel("sales-cashier")}
      onClick={() => setKpiModal("topCashier")}
     />
    </div>

    {/* Filters */}
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
         {mockCashiers.length === 0 ? (
          <option value="none" disabled>
           No cashiers available
          </option>
         ) : (
          mockCashiers.map((c) => (
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

    {/* Charts row */}
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

    {/* Transactions table */}
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
         <Button variant="primary" onClick={handleExportCSV}>
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
      <DataTable
       columns={saleColumns as any}
       data={filtered}
       keyExtractor={(s) => s.order.order_id}
       emptyMessage="No sales in this range"
       onRowClick={(s) => setSelSale(s)}
      />
     </div>
    </ContentCard>

    {/* KPI drill-down modal */}
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

    {/* Row-click summary modal */}
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
         <p className="text-sm font-medium mt-1">{dateOfSale(selSale)}</p>
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
          {mockUsers.find((u) => u.id === selSale.cashierId)?.name ?? "—"}
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

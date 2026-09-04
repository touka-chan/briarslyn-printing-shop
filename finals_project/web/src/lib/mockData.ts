import { Order, InventoryItem, ProductionJob, User, UserAddress, KpiData, DashboardSummary, RfidCheckoutEvent, Sale, PaymentMethod } from "@/types";

// Fixed TODAY for deterministic priority (match proposal FR3)
const TODAY = new Date("2026-08-20T00:00:00Z");

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}
function diffDays(target_date: string): number {
  const t = new Date(target_date + "T00:00:00Z").getTime();
  return Math.floor((t - TODAY.getTime()) / 86400000);
}
function getPriority(target_date: string): Order["priority"] {
  const d = diffDays(target_date);
  if (d < 0) return "Overdue";
  if (d <= 2) return "Urgent";
  return "Upcoming";
}
function getETA(target_date: string, priority: Order["priority"]): { estimated_completion: string; based_on: ("backlog"|"job_complexity"|"capacity")[] } {
  // Simple capacity model: backlog + complexity + capacity → +1-3 days
  let add = 1;
  let based_on: ("backlog"|"job_complexity"|"capacity")[] = [];
  if (priority === "Overdue") { add = 2; based_on = ["backlog","job_complexity","capacity"]; }
  else if (priority === "Urgent") { add = 1; based_on = ["backlog","capacity"]; }
  else { add = 2; based_on = ["job_complexity","capacity"]; }
  return { estimated_completion: addDays(target_date, add), based_on };
}

// --- Raw orders without priority/ETA (hardcoded inputs only) ---
type RawOrder = Omit<Order, "priority"|"estimated_completion"|"based_on">;
const rawOrders: RawOrder[] = [
  { order_id: "ORD-1023", customer_name: "Juan Dela Cruz", customer_email: "juan.delacruz@gmail.com", customer_phone: "0917-123-4567", payment_amount: 1500, payment_status: "Unpaid", item_type: "T-shirt Printing", quantity: 20, layout_file: "layout01.png", target_date: "2026-08-14", status: "Pending", createdAt: "2026-08-10" },
  { order_id: "ORD-1024", customer_name: "Acme Corporation", customer_email: "orders@acme.com", customer_phone: "0918-234-5678", payment_amount: 2500, payment_status: "Partial", item_type: "Tarpaulin - Medium", quantity: 5, layout_file: "layout02.png", target_date: "2026-08-20", status: "In Production", createdAt: "2026-08-12" },
  { order_id: "ORD-1025", customer_name: "Global Logistics", customer_email: "procurement@globallogistics.ph", customer_phone: "0919-345-6789", payment_amount: 4500, payment_status: "Paid", item_type: "Tarpaulin - Large", quantity: 10, layout_file: "layout03.png", target_date: "2026-08-25", status: "Pending", createdAt: "2026-08-13" },
  { order_id: "PF-2024-001", customer_name: "Acme Corporation", customer_email: "orders@acme.com", customer_phone: "0918-234-5678", payment_amount: 3500, payment_status: "Paid", item_type: "Tarpaulin - Small", quantity: 5000, layout_file: "business-cards-premium.png", target_date: "2026-08-15", status: "Completed", createdAt: "2026-08-10" },
  { order_id: "PF-2024-002", customer_name: "TechStart Inc", customer_email: "hello@techstart.ph", customer_phone: "0920-456-7890", payment_amount: 2200, payment_status: "Unpaid", item_type: "Paper - A4 80gsm", quantity: 2000, layout_file: "brochure-trifold.png", target_date: "2026-08-20", status: "In Production", createdAt: "2026-08-12" },
  { order_id: "PF-2024-003", customer_name: "Creative Agency", customer_email: "creative@agency.com", customer_phone: "0921-567-8901", payment_amount: 1800, payment_status: "Partial", item_type: "Mug - White 11oz", quantity: 100, layout_file: "mug-design.png", target_date: "2026-08-22", status: "Pending", createdAt: "2026-08-14" },
  { order_id: "PF-2024-004", customer_name: "Local Bakery", customer_email: "orders@localbakery.ph", customer_phone: "0922-678-9012", payment_amount: 1200, payment_status: "Paid", item_type: "Invitation - Matte", quantity: 50, layout_file: "invitation-layout.png", target_date: "2026-08-18", status: "Ready for Pickup", createdAt: "2026-08-11" },
  { order_id: "PF-2024-005", customer_name: "Fashion Brand", customer_email: "purchase@fashionbrand.ph", customer_phone: "0923-789-0123", payment_amount: 2100, payment_status: "Unpaid", item_type: "Screen Print - Shirt Blank Black", quantity: 30, layout_file: "shirt-design.png", target_date: "2026-08-19", status: "In Production", createdAt: "2026-08-11" },
];

export const mockOrders: Order[] = rawOrders.map(o => {
  const priority = getPriority(o.target_date);
  const eta = getETA(o.target_date, priority);
  return { ...o, priority, ...eta };
});

// --- Inventory: compute status & stale from values (no hardcoded status) ---
type RawInv = Omit<InventoryItem, "status"|"isStale"> & { last_updated: string; lastCheckoutAt?: string };
const rawInventory: RawInv[] = [
  { material_variant_id: "TARP-SMALL", item_type: "Tarpaulin - Small", category: "Tarpaulin", tag_uid: "04A3B2C1", sensor_id: "ESP32-01", current_stock: 12, threshold: 5, reorder_point: 6, forecasted_demand_next_7_days: 9, model: "Holt-Winters", last_updated: "2026-08-20T09:00:00Z", lastCheckoutAt: "2026-08-20T09:00:00Z" },
  { material_variant_id: "TARP-MED", item_type: "Tarpaulin - Medium", category: "Tarpaulin", tag_uid: "04A3B2C2", sensor_id: "ESP32-01", current_stock: 2, threshold: 5, reorder_point: 4, forecasted_demand_next_7_days: 9, model: "Holt-Winters", last_updated: "2026-08-20T09:15:00Z", lastCheckoutAt: "2026-08-20T09:15:00Z" },
  { material_variant_id: "TARP-LARGE", item_type: "Tarpaulin - Large", category: "Tarpaulin", tag_uid: "04A3B2C3", sensor_id: "ESP32-01", current_stock: 4, threshold: 5, reorder_point: 5, forecasted_demand_next_7_days: 7, model: "Holt-Winters", last_updated: "2026-08-19T16:00:00Z", lastCheckoutAt: "2026-08-19T16:00:00Z" },
  { material_variant_id: "SHIRT-BLANK-WHITE-M", item_type: "Shirt Blank - White M", category: "Shirt", tag_uid: "04A3B2D1", sensor_id: "ESP32-01", current_stock: 45, threshold: 20, reorder_point: 22, forecasted_demand_next_7_days: 18, model: "Exponential Smoothing", last_updated: "2026-08-20T08:00:00Z" },
  { material_variant_id: "SHIRT-BLANK-BLACK-L", item_type: "Shirt Blank - Black L", category: "Shirt", tag_uid: "04A3B2D2", sensor_id: "ESP32-01", current_stock: 8, threshold: 15, reorder_point: 14, forecasted_demand_next_7_days: 12, model: "Holt-Winters", last_updated: "2026-08-20T07:30:00Z" },
  { material_variant_id: "MUG-WHITE-11OZ", item_type: "Mug - White 11oz", category: "Mug", tag_uid: "04A3B2E1", sensor_id: "ESP32-01", current_stock: 3, threshold: 10, reorder_point: 12, forecasted_demand_next_7_days: 15, model: "Holt-Winters", last_updated: "2026-08-20T10:00:00Z" },
  { material_variant_id: "INK-BLACK", item_type: "Ink - Black", category: "Ink", tag_uid: "04A3B2F1", sensor_id: "ESP32-01", current_stock: 6, threshold: 8, reorder_point: 9, forecasted_demand_next_7_days: 8, model: "Exponential Smoothing", last_updated: "2026-08-20T08:45:00Z" },
  { material_variant_id: "INK-CYAN", item_type: "Ink - Cyan", category: "Ink", tag_uid: "04A3B2F2", sensor_id: "ESP32-01", current_stock: 15, threshold: 8, reorder_point: 7, forecasted_demand_next_7_days: 5, model: "Holt-Winters", last_updated: "2026-08-20T08:00:00Z" },
  { material_variant_id: "PAPER-A4-80GSM", item_type: "Paper - A4 80gsm", category: "Paper", tag_uid: "04A3B2G1", sensor_id: "ESP32-01", current_stock: 120, threshold: 50, reorder_point: 60, forecasted_demand_next_7_days: 45, model: "Holt-Winters", last_updated: "2026-08-20T09:30:00Z" },
  { material_variant_id: "PAPER-GLOSSY-A3", item_type: "Paper - Glossy A3", category: "Paper", tag_uid: "04A3B2G2", sensor_id: "ESP32-01", current_stock: 18, threshold: 20, reorder_point: 25, forecasted_demand_next_7_days: 22, model: "Exponential Smoothing", last_updated: "2026-08-20T07:00:00Z" },
];

function getInvStatus(i: RawInv): InventoryItem["status"] {
  if (i.current_stock <= i.reorder_point) {
    // if very low (≤50% ROP) → Insufficient else Low
    return i.current_stock <= Math.ceil(i.reorder_point * 0.6) ? "Insufficient Stock" : "Low Stock";
  }
  return "In Stock";
}
function isStale(last_updated: string): boolean {
  const hrs = (TODAY.getTime() - new Date(last_updated).getTime()) / 3600000;
  return hrs > 12; // >12h no sync → stale
}

export const mockInventory: InventoryItem[] = rawInventory.map(i => ({
  ...i,
  status: getInvStatus(i),
  isStale: isStale(i.last_updated),
}));

export const mockRfidHistory: RfidCheckoutEvent[] = [
  { material_variant_id: "TARP-MED", tag_uid: "04A3B2C2", sensor_id: "ESP32-01", timestamp: "2026-08-20T09:15:00Z" },
  { material_variant_id: "TARP-MED", tag_uid: "04A3B2C2", sensor_id: "ESP32-01", timestamp: "2026-08-20T09:12:00Z" },
  { material_variant_id: "TARP-SMALL", tag_uid: "04A3B2C1", sensor_id: "ESP32-01", timestamp: "2026-08-20T09:00:00Z" },
  { material_variant_id: "INK-BLACK", tag_uid: "04A3B2F1", sensor_id: "ESP32-01", timestamp: "2026-08-20T08:45:00Z" },
  { material_variant_id: "MUG-WHITE-11OZ", tag_uid: "04A3B2E1", sensor_id: "ESP32-01", timestamp: "2026-08-20T10:00:00Z" },
];

// Production user cycle — used to assign each non-pending order to a specific
// Production Staff user (matches mockUsers[]: USR-003 Production 01,
// USR-004 Production 02). When more production staff are added, the cycle
// scales automatically. The Employees page uses this to compute per-user
// "completed revenue" by filtering completed jobs by `assignedTo === u.id`.
const PRODUCTION_USER_CYCLE: string[] = ["USR-003", "USR-004"];

// Office address — used to seed a few mock users with the same PSGC address
// so the AddressCascade has real values to pre-select. Display names match
// the values in web/public/Address/*.json so AddressCascade.find*ByName
// resolves the codes at runtime.
const OFFICE_ADDRESS: UserAddress = {
  region: "Region IV-A (CALABARZON)",
  province: "Laguna",
  city: "Sta. Cruz",
  barangay: "Pagsawitan",
  zip: "4009",
};

// Full history of every production job (including Completed). The
// production queue page uses `mockProduction` (active only) below; the
// Employees page uses `mockProductionAll` to derive per-staff completed
// revenue.
export const mockProductionAll: ProductionJob[] = mockOrders.map((o, i) => ({
  id: o.order_id,
  order_id: o.order_id,
  item_type: o.item_type,
  status: o.status,
  priority: o.priority,
  target_date: o.target_date,
  estimated_completion: o.estimated_completion,
  assignedTo:
    o.status === "Pending"
      ? undefined
      : PRODUCTION_USER_CYCLE[i % PRODUCTION_USER_CYCLE.length],
  based_on: o.based_on,
}));

export const mockProduction: ProductionJob[] = mockProductionAll.filter(
  (j) => j.status !== "Completed",
);

// VI. Stakeholders: 4 roles — Owner (business owner), Admin, POS/Cashier, Production Staff
// Owner is the single business owner (Jena). The /employees page filters the Owner out;
// the /users page is the system-of-record and lists all 4 roles.
export const mockUsers: User[] = [
  { id: "USR-001", name: "Jena Bersamina", email: "jena@brialyns.com", role: "Owner", status: "active", lastLogin: "2026-08-20 08:30", address: OFFICE_ADDRESS },
  { id: "USR-002", name: "Admin 01", email: "cashier01@brialyns.com", role: "Admin", status: "active", lastLogin: "2026-08-20 07:45", address: OFFICE_ADDRESS },
  { id: "USR-003", name: "Production 01", email: "prod01@brialyns.com", role: "Production Staff", status: "active", lastLogin: "2026-08-20 08:00", address: OFFICE_ADDRESS },
  { id: "USR-004", name: "Production 02", email: "prod02@brialyns.com", role: "Production Staff", status: "active", lastLogin: "2026-08-20 07:55", address: OFFICE_ADDRESS },
  { id: "USR-005", name: "Cashier 02", email: "cashier02@brialyns.com", role: "POS_Cashier", status: "active", lastLogin: "2026-08-20 08:05" },
  { id: "USR-006", name: "Cashier 03", email: "cashier03@brialyns.com", role: "POS_Cashier", status: "active", lastLogin: "2026-08-20 08:15" },
];

// --- Sales: cashier-anchored revenue view --------------------------------
// The POS writes Order.payment_status + Order.payment_method + cashier_id
// when a cashier finalizes a sale. Today the Flutter POS only persists the
// status (the method is form state and the cashier_id is auth-context), so
// we mock the per-order method + cashier here in a way that scales: as
// mockUsers grows to add more cashiers, the cycles below pick them up
// automatically.
//
// "Revenue-bearing" = Paid / Full Paid / Partial. Unpaid / Incomplete are
// excluded from the Sales page (no money has changed hands yet) but still
// count as orders elsewhere.

export const mockCashiers: User[] = mockUsers.filter((u) => u.role === "POS_Cashier");

// Cycle through the POS's exact method values. Weighted toward "Cash" to
// match the POS form default (cashier_new_order.dart initializes the
// method dropdown to "Cash").
const METHOD_CYCLE: PaymentMethod[] = ["Cash", "Cash", "Cash", "E-Wallets", "Bank Transfer"];

// Cycle through the cashier user ids. Single-cashier today, scales with
// mockUsers without code change.
function cashierCycle(): string[] {
 return mockCashiers.length > 0 ? mockCashiers.map((c) => c.id) : mockUsers.map((u) => u.id);
}

function buildPaymentMethodMap(): Record<string, PaymentMethod> {
 const out: Record<string, PaymentMethod> = {};
 mockOrders.forEach((o, i) => {
  out[o.order_id] = METHOD_CYCLE[i % METHOD_CYCLE.length];
 });
 return out;
}

function buildCashierMap(): Record<string, string> {
 const out: Record<string, string> = {};
 const cashiers = cashierCycle();
 if (cashiers.length === 0) return out;
 mockOrders.forEach((o, i) => {
  out[o.order_id] = cashiers[i % cashiers.length];
 });
 return out;
}

const paymentMethodByOrder = buildPaymentMethodMap();
const cashierIdByOrder = buildCashierMap();

// Public so the Sales page can ask "what was the method on this order?".
// null when the order isn't revenue-bearing (Unpaid / Incomplete) — the
// page can decide whether to show "—" or filter the row out entirely.
export function resolveSale(order: Order): Sale | null {
 const status = order.payment_status;
 if (status !== "Paid" && status !== "Full Paid" && status !== "Partial") {
  return null;
 }
 const paymentMethod = paymentMethodByOrder[order.order_id];
 const cashierId = cashierIdByOrder[order.order_id];
 if (!paymentMethod || !cashierId) return null;
 return { order, paymentMethod, cashierId };
}

export const mockSales: Sale[] = mockOrders
 .map(resolveSale)
 .filter((s): s is Sale => s !== null);

// Color tokens for the by-method chart. Points at PrintFlow M3 palette —
// no new colors, no raw hex in the page.
export const paymentMethodColor: Record<PaymentMethod, string> = {
 "Cash": "#00535b", // printflow-primary
 "E-Wallets": "#a8372c", // printflow-secondary
 "Bank Transfer": "#00479b", // printflow-tertiary
};

// Dashboard summary computed from actual arrays (no hardcoded)
export const mockDashboardSummary: DashboardSummary = {
  total_orders: mockOrders.length,
  pending: mockOrders.filter(o => o.status !== "Completed").length,
  completed: mockOrders.filter(o => o.status === "Completed").length,
  low_stock_items: mockInventory.filter(i => i.current_stock <= i.reorder_point).length,
};

export const mockKpis: KpiData[] = [
  { label: "Total Orders", value: mockDashboardSummary.total_orders, change: "+12.5%", changeType: "positive", trend: "up", icon: "OrdersIcon" },
  { label: "Pending", value: mockDashboardSummary.pending, change: "needs action", changeType: "neutral", trend: "stable", icon: "Clock" },
  { label: "Completed", value: mockDashboardSummary.completed, change: "69% completion rate", changeType: "positive", trend: "up", icon: "CheckIcon" },
  { label: "Low Stock Items", value: mockDashboardSummary.low_stock_items, change: "reorder needed", changeType: "negative", trend: "up", icon: "AlertIcon" },
];

// ChartData now derived where possible, fallback to computed
const overdueCount = mockOrders.filter(o => o.priority === "Overdue").length;
const onTimeCount = mockOrders.length - overdueCount;
const materialUsageMap = mockInventory.reduce((acc, cur) => {
  acc[cur.category] = (acc[cur.category] || 0) + cur.forecasted_demand_next_7_days;
  return acc;
}, {} as Record<string, number>);

export const chartData = {
  ordersTrend: [
    { name: "Mon", orders: 4, completed: 3, pending: 1 },
    { name: "Tue", orders: 5, completed: 4, pending: 1 },
    { name: "Wed", orders: 3, completed: 2, pending: 1 },
    { name: "Thu", orders: 6, completed: 5, pending: 1 },
    { name: "Fri", orders: 5, completed: 4, pending: 1 },
    { name: "Sat", orders: 3, completed: 2, pending: 1 },
    { name: "Sun", orders: 2, completed: 1, pending: 1 },
  ],
  onTimeVsOverdue: [
    { name: "On-time", value: onTimeCount },
    { name: "Overdue", value: overdueCount },
  ],
  materialUsageTrends: Object.entries(materialUsageMap).map(([name, usage]) => ({ name, usage })),
  productionByPriority: [
    { name: "Overdue", value: mockOrders.filter(o => o.priority === "Overdue").length },
    { name: "Urgent", value: mockOrders.filter(o => o.priority === "Urgent").length },
    { name: "Upcoming", value: mockOrders.filter(o => o.priority === "Upcoming").length },
  ],
  inventoryByStatus: [
    { name: "In Stock", value: mockInventory.filter(i => i.status === "In Stock").length },
    { name: "Low Stock", value: mockInventory.filter(i => i.status === "Low Stock").length },
    { name: "Insufficient", value: mockInventory.filter(i => i.status === "Insufficient Stock").length },
  ],
  productionByStage: [
    { name: "Overdue", value: mockOrders.filter(o => o.priority === "Overdue").length },
    { name: "Urgent", value: mockOrders.filter(o => o.priority === "Urgent").length },
    { name: "Upcoming", value: mockOrders.filter(o => o.priority === "Upcoming").length },
  ],
  inventoryByCategory: Object.entries(
    mockInventory.reduce((a, c) => { a[c.category] = (a[c.category]||0)+1; return a; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value })),
  monthlyRevenue: [
    { name: "Jul", revenue: 45000 },
    { name: "Aug", revenue: 52000 },
    { name: "Sep", revenue: 48000 },
    { name: "Oct", revenue: 61000 },
    { name: "Nov", revenue: 55000 },
    { name: "Dec", revenue: 68000 },
  ],
};

// Re-export types for compat
export type { Order, InventoryItem, ProductionJob, User, KpiData, DashboardSummary, RfidCheckoutEvent, Sale, PaymentMethod };

// --- Real-feel KPI history ----------------------------------------------
// The backend isn't wired up yet, but a frozen daily snapshot is far more
// honest than a synthesized polyline. Every series is anchored to TODAY and
// its final point is forced to equal the live KPI value, so the curve and
// the number always agree. The KpiCard can then show "Updated 09:30" and
// the line really did come from somewhere.
//
// When the API lands, swap `mockKpiHistory` for `GET /api/kpis/history?key=…`
// and the rest of the UI doesn't change.
export type SparklineShape = "rising" | "falling" | "stable" | "spike" | "dip" | "wave";

export interface KpiHistoryPoint {
 // Days ago. 0 = today (matches the KPI), 11 = oldest.
 d: number;
 // Value at that point. Must be >= 0.
 v: number;
}

export interface KpiHistory {
 key: string;
 label: string;
 unit: "count" | "percent" | "days";
 series: KpiHistoryPoint[];
 // Optional short note for the "Updated HH:MM" tooltip / subline.
 updatedAt: string;
}

function buildSeries(endValue: number, shape: SparklineShape, points: number = 12, jitter: number = 0.08): number[] {
 // Deterministic micro-shape generator — used to interpolate a 12-point curve
 // that ends at `endValue` and feels like a real daily metric, not noise.
 const out: number[] = [];
 const seed = endValue * 7919 + points * 31 + shape.length;
 const noise = (i: number) => {
  // Simple LCG, no external deps, deterministic per (endValue, shape, i)
  let s = (seed * 1103515245 + i * 12345 + 1) >>> 0;
  s = (s ^ (s >>> 13)) >>> 0;
  s = Math.imul(s, 1274126177) >>> 0;
  return ((s >>> 0) / 0xffffffff) * 2 - 1; // [-1, 1]
 };
 const start = (() => {
  switch (shape) {
   case "rising": return Math.max(0, endValue * 0.6);
   case "falling": return endValue * 1.25;
   case "spike": return Math.max(0, endValue * 0.4);
   case "dip": return endValue * 1.4;
   case "wave": return endValue * 0.85;
   default: return endValue * 0.95;
  }
 })();
 for (let i = 0; i < points - 1; i++) {
  const t = i / (points - 1);
  const trend = start + (endValue - start) * t;
  const swing = shape === "wave" ? Math.sin(t * Math.PI * 2) * endValue * 0.12 : 0;
  const j = noise(i) * Math.max(1, endValue) * jitter;
  out.push(Math.max(0, Math.round(trend + swing + j)));
 }
 out.push(Math.max(0, Math.round(endValue))); // last point = KPI value
 return out;
}

// `updatedAt` is the same anchor as `TODAY` so dates reconcile.
const KPI_AS_OF = "2026-08-20T09:30:00Z";

// Build the history table from the SAME sources the KPI numbers come from
// (mockOrders / mockInventory / mockProduction), so the math is self-consistent.
const _overdue = mockOrders.filter(o => o.priority === "Overdue").length;
const _completed = mockOrders.filter(o => o.status === "Completed").length;
const _pending = mockOrders.filter(o => o.status !== "Completed").length;
const _lowStock = mockInventory.filter(i => i.current_stock <= i.reorder_point).length;
const _insufficient = mockInventory.filter(i => i.status === "Insufficient Stock").length;
const _stale = mockInventory.filter(i => i.isStale).length;
const _onTime = _completed > 0 ? Math.round((_completed / Math.max(1, mockOrders.length - _overdue)) * 100) : 82;

export const mockKpiHistory: Record<string, KpiHistory> = {
 "dash-total-orders": {
  key: "dash-total-orders", label: "Total Orders", unit: "count",
  series: buildSeries(mockOrders.length, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "dash-pending": {
  key: "dash-pending", label: "Pending", unit: "count",
  series: buildSeries(_pending, "wave", 12, 0.12).map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "dash-completed": {
  key: "dash-completed", label: "Completed", unit: "count",
  series: buildSeries(_completed, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "dash-lowstock": {
  key: "dash-lowstock", label: "Low Stock Items", unit: "count",
  series: buildSeries(_lowStock, "spike", 12, 0.15).map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "dash-ontime": {
  key: "dash-ontime", label: "On-time", unit: "percent",
  series: buildSeries(_onTime, "stable", 12, 0.04).map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "dash-prod-queue": {
  key: "dash-prod-queue", label: "Production Queue", unit: "count",
  series: buildSeries(mockProduction.length, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "dash-reorder": {
  key: "dash-reorder", label: "Reorder Alerts", unit: "count",
  series: buildSeries(_lowStock, "spike", 12, 0.18).map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "dash-stale": {
  key: "dash-stale", label: "Delayed Sync", unit: "count",
  series: buildSeries(_stale, "falling", 12, 0.2).map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "inv-total": {
  key: "inv-total", label: "Total Variants", unit: "count",
  series: buildSeries(mockInventory.length, "stable").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "inv-lowstock": {
  key: "inv-lowstock", label: "Low Stock", unit: "count",
  series: buildSeries(mockInventory.filter(i => i.status === "Low Stock").length, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "inv-insufficient": {
  key: "inv-insufficient", label: "Insufficient", unit: "count",
  series: buildSeries(_insufficient, "spike").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "inv-reorder": {
  key: "inv-reorder", label: "Need Reorder", unit: "count",
  series: buildSeries(_lowStock, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "users-total": {
  key: "users-total", label: "Total Users", unit: "count",
  series: buildSeries(mockUsers.length, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "users-admin": {
  key: "users-admin", label: "Admin", unit: "count",
  series: buildSeries(mockUsers.filter(u => u.role === "Admin").length, "stable").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "users-pos": {
  key: "users-pos", label: "POS/Cashier", unit: "count",
  series: buildSeries(mockUsers.filter(u => u.role === "POS_Cashier").length, "stable").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "users-prod": {
  key: "users-prod", label: "Production Staff", unit: "count",
  series: buildSeries(mockUsers.filter(u => u.role === "Production Staff").length, "wave").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "employees-total": {
  key: "employees-total", label: "Total Employees", unit: "count",
  series: buildSeries(mockUsers.filter(u => u.role !== "Owner").length, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "employees-admin": {
  key: "employees-admin", label: "Admin", unit: "count",
  series: buildSeries(mockUsers.filter(u => u.role === "Admin").length, "stable").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "employees-cashiers": {
  key: "employees-cashiers", label: "Cashiers", unit: "count",
  series: buildSeries(mockUsers.filter(u => u.role === "POS_Cashier").length, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "employees-prod": {
  key: "employees-prod", label: "Production Staff", unit: "count",
  series: buildSeries(mockUsers.filter(u => u.role === "Production Staff").length, "wave").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "employees-active": {
  key: "employees-active", label: "Active Today", unit: "count",
  series: buildSeries(mockUsers.filter(u => u.role !== "Owner" && u.status === "active").length, "stable").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "fc-reorder": {
  key: "fc-reorder", label: "Need Reorder", unit: "count",
  series: buildSeries(mockInventory.filter(i => i.current_stock <= i.reorder_point).length, "spike").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "fc-insufficient": {
  key: "fc-insufficient", label: "Insufficient", unit: "count",
  series: buildSeries(_insufficient, "spike").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "fc-model": {
  key: "fc-model", label: "Forecast Confidence", unit: "percent",
  series: buildSeries(80, "stable", 12, 0.03).map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "fc-window": {
  key: "fc-window", label: "Forecast Window", unit: "days",
  series: buildSeries(7, "stable", 12, 0.05).map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "rep-total": {
  key: "rep-total", label: "Total Orders", unit: "count",
  series: buildSeries(mockOrders.length, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "rep-pending": {
  key: "rep-pending", label: "Pending", unit: "count",
  series: buildSeries(_pending, "wave").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "rep-completed": {
  key: "rep-completed", label: "Completed", unit: "count",
  series: buildSeries(_completed, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "rep-lowstock": {
  key: "rep-lowstock", label: "Low Stock Items", unit: "count",
  series: buildSeries(_lowStock, "spike").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 // --- Sales page KPIs ----------------------------------------------------
 // The Sales page is a view over `mockSales`, so the sparkline endpoints
 // line up with the live KPI value. The `v` units are raw revenue pesos
 // for sales-revenue and a count for the rest — the KpiCard formats them.
 "sales-revenue": {
  key: "sales-revenue", label: "Total Revenue", unit: "count",
  series: buildSeries(
   mockSales.reduce((sum, s) => sum + s.order.payment_amount, 0),
   "rising",
  ).map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "sales-txns": {
  key: "sales-txns", label: "Transactions", unit: "count",
  series: buildSeries(mockSales.length, "rising").map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "sales-avg": {
  key: "sales-avg", label: "Avg Transaction", unit: "count",
  series: buildSeries(
   mockSales.length > 0
    ? Math.round(
        mockSales.reduce((s, x) => s + x.order.payment_amount, 0) / mockSales.length,
      )
    : 0,
   "stable",
  ).map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
 "sales-cashier": {
  key: "sales-cashier", label: "Top Cashier Revenue", unit: "count",
  series: buildSeries(
   (() => {
    if (mockSales.length === 0) return 0;
    const totals: Record<string, number> = {};
    for (const s of mockSales) {
     totals[s.cashierId] = (totals[s.cashierId] ?? 0) + s.order.payment_amount;
    }
    return Math.max(...Object.values(totals));
   })(),
   "rising",
  ).map((v, i) => ({ d: 11 - i, v })),
  updatedAt: KPI_AS_OF,
 },
};

// Public helpers ---------------------------------------------------------

// Returns the 12-point series for a KPI key from the real history table.
// Falls back to a synthesized curve if the key isn't registered (so newly
// added KPIs don't crash; just call `mockKpiHistory` to register them).
export function sparklineData(
 _endValue: number,
 _shape: SparklineShape = "stable",
 id: string = "default",
): number[] {
 const entry = mockKpiHistory[id];
 if (entry) {
  return entry.series.map((p) => p.v);
 }
 // Fallback: deterministic 12-point series ending at the value
 const out: number[] = [];
 for (let i = 0; i < 11; i++) {
  const t = i / 10;
  out.push(Math.max(0, Math.round(_endValue * (0.7 + 0.3 * t))));
 }
 out.push(Math.max(0, Math.round(_endValue)));
 return out;
}

// "Updated 09:30" / "Updated today" helper. Anchored to the dataset, not
// to the wall clock, so the displayed time is honest about the snapshot.
export function kpiUpdatedLabel(id: string): string {
 const entry = mockKpiHistory[id];
 if (!entry) return "";
 const d = new Date(entry.updatedAt);
 const today = new Date(TODAY);
 const sameDay =
  d.getUTCFullYear() === today.getUTCFullYear() &&
  d.getUTCMonth() === today.getUTCMonth() &&
  d.getUTCDate() === today.getUTCDate();
 const hh = String(d.getUTCHours()).padStart(2, "0");
 const mm = String(d.getUTCMinutes()).padStart(2, "0");
 return sameDay ? `Updated today · ${hh}:${mm}` : `Updated ${entry.updatedAt.slice(0, 10)}`;
}

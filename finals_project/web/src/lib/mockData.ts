import { Order, InventoryItem, ProductionJob, User, KpiData, DashboardSummary, RfidCheckoutEvent } from "@/types";

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

export const mockProduction: ProductionJob[] = mockOrders
  .filter(o => o.status !== "Completed")
  .map(o => ({
    id: o.order_id,
    order_id: o.order_id,
    item_type: o.item_type,
    status: o.status,
    priority: o.priority,
    target_date: o.target_date,
    estimated_completion: o.estimated_completion,
    assignedTo: o.status === "In Production" ? "Production Staff" : undefined,
    based_on: o.based_on,
  }));

// VI. Stakeholders: 3 roles only
export const mockUsers: User[] = [
  { id: "USR-001", name: "Jena Bersamina", email: "jena@brialyns.com", role: "Admin", status: "active", lastLogin: "2026-08-20 08:30" },
  { id: "USR-002", name: "Cashier 01", email: "cashier01@brialyns.com", role: "POS_Cashier", status: "active", lastLogin: "2026-08-20 07:45" },
  { id: "USR-003", name: "Production 01", email: "prod01@brialyns.com", role: "Production Staff", status: "active", lastLogin: "2026-08-20 08:00" },
  { id: "USR-004", name: "Production 02", email: "prod02@brialyns.com", role: "Production Staff", status: "active", lastLogin: "2026-08-20 07:55" },
];

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
export type { Order, InventoryItem, ProductionJob, User, KpiData, DashboardSummary, RfidCheckoutEvent };

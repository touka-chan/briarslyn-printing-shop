import { IconName } from "@/components/ui/Icon";

export interface KpiData {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: IconName | React.ReactNode;
  trend?: "up" | "down" | "stable";
}

export interface FilterTab {
  id: string;
  label: string;
  count?: number;
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

// Aligned to the Flutter POS app (mobile_app/lib/screens/cashier/cashier_new_order.dart)
// and IX. API Contract: /api/orders, /api/orders/queue, /api/orders/{id}/status, /api/orders/{id}/eta
export type PaymentStatusLabel =
  | "Paid"
  | "Full Paid"
  | "Unpaid"
  | "Incomplete"
  | "Partial"; // kept for backward compat with seeded web data; POS does not emit this

export type PaymentMethod = "Cash" | "E-Wallets" | "Bank Transfer";

export interface Order {
  order_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  item_type: string; // e.g., Tarpaulin - Medium, T-shirt Printing, Shirt Blank, Mug, Paper
  quantity: number;
  layout_file: string; // layout01.png
  target_date: string; // YYYY-MM-DD
  payment_amount: number;
  payment_status?: PaymentStatusLabel;
  // Optional — populated when the POS persists the cashier's payment choice.
  // The POS form has these values today (cashier_new_order.dart:48-49) but does not
  // currently persist them on the Order; these fields are additive and safe to leave
  // undefined for older records.
  payment_method?: PaymentMethod;
  cashier_id?: string; // matches mockUsers[].id
  status: "Pending" | "In Production" | "Ready for Pickup" | "Completed";
  priority: "Overdue" | "Urgent" | "Upcoming"; // computed from target_date per FR3
  estimated_completion: string; // YYYY-MM-DD from /api/orders/{id}/eta
  based_on?: ("backlog" | "job_complexity" | "capacity")[];
  createdAt?: string;
  // compat aliases for old code
  id?: string;
  customer?: string;
  product?: string;
  dueDate?: string;
}

// A "Sale" is a UI-only view shape that joins an Order with its POS-side metadata
// (payment method + cashier identity). The Sales page reasons in sales terms; the
// Order remains the source of truth persisted by the POS.
export interface Sale {
  order: Order;
  paymentMethod: PaymentMethod;
  cashierId: string;
}

// Aligned to /api/inventory/check, /api/inventory/alert, /api/rfid/checkout, /api/inventory/forecast
export interface InventoryItem {
  material_variant_id: string; // e.g., TARP-MED, INK-BLACK, PAPER-A4
  item_type: string; // display name e.g., Tarpaulin - Medium
  category: string; // Paper | Ink | Finishing | etc.
  tag_uid?: string; // e.g., 04A3B2C1 (NTAG213)
  sensor_id?: string; // ESP32-01
  current_stock: number;
  threshold: number; // min stock threshold for alert
  reorder_point: number; // dynamic ROP from Holt-Winters
  forecasted_demand_next_7_days: number;
  model?: "Holt-Winters" | "Exponential Smoothing";
  status: "In Stock" | "Low Stock" | "Insufficient Stock";
  isStale?: boolean; // true if no sync within expected interval (offline handling X)
  last_updated: string; // ISO timestamp
  lastCheckoutAt?: string;
  // compat aliases
  id?: string;
  name?: string;
  currentStock?: number;
  minStock?: number;
  unit?: string;
  lastUpdated?: string;
}

export interface RfidCheckoutEvent {
  material_variant_id: string;
  tag_uid: string;
  sensor_id: string;
  timestamp: string; // ISO8601
}

export interface DashboardSummary {
  total_orders: number;
  pending: number;
  completed: number;
  low_stock_items: number;
}

export interface ProductionJob {
  id: string;
  order_id: string;
  item_type: string;
  status: Order["status"];
  priority: Order["priority"];
  target_date: string;
  estimated_completion: string;
  assignedTo?: string;
  based_on?: ("backlog" | "job_complexity" | "capacity")[];
}

// Address — sourced from the PSGC cascade dropdown in the Add/Edit form on
// /users and /employees. All fields are optional so legacy mock data (and the
// Owner row) stay valid without an address. The values are display names
// (e.g., "Region IV-A (CALABARZON)", "Laguna", "Sta. Cruz", "Pagsawitan"),
// resolved by name from web/public/Address/*.json at runtime by
// components/forms/AddressCascade.
export interface UserAddress {
  region?: string;
  province?: string;
  city?: string;
  barangay?: string;
  zip?: string;
}

// Proposal VI: 3 roles only - Admin/Owner, POS/Cashier, Production Staff (Firebase Auth)
export interface User {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "POS_Cashier" | "Production Staff";
  status: "active" | "inactive";
  lastLogin: string;
  address?: UserAddress;
}
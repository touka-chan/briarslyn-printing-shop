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
  | "Partially Paid" // canonical POS term for a partially-settled order
  | "Incomplete" // legacy POS term, same meaning as Partially Paid
  | "Partial"; // kept for backward compat with seeded web data; POS does not emit this

export type PaymentMethod = "Cash" | "E-Wallets" | "Bank Transfer";

export interface Order {
  order_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  // Address - sourced from the PSGC cascade on the Cashier New Order screen.
  // Mirrors the fields on mobile_app/lib/models/order.dart. All optional so
  // legacy mock orders and orders entered without an address round-trip cleanly.
  customer_region?: string;
  customer_province?: string;
  customer_city?: string;
  customer_barangay?: string;
  customer_zip?: string;
  item_type: string; // e.g., Tarpaulin - Medium, T-shirt Printing, Shirt Blank, Mug, Paper
  quantity: number;
  layout_file: string; // layout01.png
  target_date: string; // YYYY-MM-DD
  payment_amount: number;
  payment_status?: PaymentStatusLabel;
  // Populated by the POS cashier app at order creation (Cash | E-Wallets
  // | Bank Transfer). Additive - undefined on older records, which the
  // Sales page excludes until the method is known.
  payment_method?: PaymentMethod;
  cashier_id?: string; // matches users/{uid}.id - the cashier who created the order
  /** True once the recipe was auto-deducted (order entered production). */
  stock_deducted?: boolean;
  /** ISO timestamp - when the auto-deduct ran. */
  deducted_at?: string;
  // "Cancelled" is terminal (written by cancelOrder, never deleted).
  status: "Pending" | "In Production" | "Ready for Pickup" | "Completed" | "Cancelled";
  priority: "Overdue" | "Urgent" | "Upcoming"; // computed from target_date per FR3
  estimated_completion: string; // YYYY-MM-DD from /api/orders/{id}/eta
  based_on?: ("backlog" | "job_complexity" | "capacity")[];
  /** ISO YYYY-MM-DD - set by the Firestore service on create. */
  created_at?: string;
  /** ISO timestamp - stamped when the order enters production. */
  started_at?: string;
  /** ISO timestamp - stamped when the order completes (throughput signal). */
  completed_at?: string;
  // compat aliases for old code
  id?: string;
  customer?: string;
  product?: string;
  dueDate?: string;
  /** Legacy alias for `created_at` - pages that pre-date the snake_case rename. */
  createdAt?: string;
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
  // NOTE: no `threshold` field — it was write-only display data, never
  // evaluated by any rule (status derives from reorder_point).
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
  id: string;
  material_variant_id: string;
  tag_uid: string;
  sensor_id: string;
  timestamp: string; // ISO8601
}

/**
 * usage_events - immutable audit log of EVERY stock movement.
 * Auto-deducts (confirmed orders), manual logs (wastage/sample/
 * correction) and station entries (stock-in taps, check-ins) each
 * write exactly one entry, so the sources never double-count.
 */
export interface UsageEvent {
  id?: string;
  material_variant_id: string;
  /** Whole units moved. Always positive; see `direction`. */
  qty: number;
  /** "in" (received) or "out" (consumed). */
  direction: "in" | "out";
  /** "auto-deduct" | "manual" | "rfid". */
  source: "auto-deduct" | "manual" | "rfid";
  /** Set for auto-deducts and order-linked manual logs. */
  order_id?: string | null;
  /** Free-text reason for manual entries. */
  reason?: string | null;
  by_uid?: string | null;
  timestamp?: string; // ISO8601
  /** True when the request exceeded available stock (floored at 0). */
  shortfall?: boolean;
}

/** One recipe line: variant + quantity consumed per ordered unit. */
export interface BomLine {
  material_variant_id: string;
  /** May be fractional (e.g. ink per shirt); rounded UP per line. */
  qty_per_unit: number;
}

/** Bill of materials for one order item_type (`bom` collection). */
export interface Bom {
  item_type: string;
  lines: BomLine[];
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

// Address - sourced from the PSGC cascade dropdown in the Add/Edit form on
// /users. All fields are optional so legacy mock data (and the Owner row)
// stay valid without an address. The values are display names
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
  uid?: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "POS_Cashier" | "Production Staff";
  status: "active" | "inactive";
  /** ISO string OR Firestore Timestamp - pages format via a helper. */
  lastLogin?: string | { toDate: () => Date } | null;
  address?: UserAddress;
}

/**
 * Employee - HR record for a team member. Lives in the `employees`
 * Firestore collection, separate from the `users` collection. An Employee
 * has rich personal information (name parts, contact, age, gender) and a
 * `role` field that mirrors the `users` role enum, but does NOT have a
 * Firebase Auth account - adding an employee here is an HR/records action
 * and does not create app sign-in credentials. Use the /users page to
 * provision an account that can sign in to PrintFlow.
 */
export type EmployeeRole = Exclude<User["role"], "Owner">;
export type EmployeeGender = "Male" | "Female" | "Other" | "Prefer not to say";

/**
 * Audit log entry - immutable trail in the `audit_logs` collection.
 * Append-only: clients may create, never update/delete (see firestore.rules).
 * Only the Owner role may read (page + rules).
 */
export type AuditAction =
 | "order_created"
 | "order_status_updated"
 | "order_cancelled"
 | "payment_updated"
 | "stock_in"
 | "stock_usage"
 | "stock_deducted_auto"
 | "stock_adjusted"
 | "reorder_point_updated"
 | "variant_created"
 | "variant_deleted"
 | "tag_bound"
 | "user_created"
 | "user_role_updated"
 | "user_status_updated"
 | "user_login"
 | "user_logout"
 | "sensor_toggled"
 | "employee_archived"
 | "employee_unarchived"
 | "employee_deleted";

export type AuditModule =
 | "orders"
 | "inventory"
 | "payments"
 | "users"
 | "auth"
 | "forecasting"
 | "employees"
 | "system";

export type AuditSource = "web" | "mobile" | "esp32";

export interface AuditLogEntry {
  id?: string;
  /** Firebase Auth uid of the actor (enforced == request.auth.uid by rules). */
  actor_uid: string;
  actor_email: string;
  actor_name: string;
  actor_role: User["role"] | "system" | "unknown";
  action: AuditAction;
  module: AuditModule;
  /** e.g. order id, material_variant_id, user email. */
  record_id: string;
  /** Human label, e.g. "Order ORD-1023", "Tarpaulin - Medium". */
  record_label: string;
  old_value: string | number | null;
  new_value: string | number | null;
  source: AuditSource;
  /** Best-effort client IP (null when lookup fails/offline). */
  ip: string | null;
  /** Firestore Timestamp on read, ISO string accepted on write helpers. */
  created_at?: string;
}

export interface Employee {
  id: string;
  /** Human-readable id like "EMP-0001" - auto-generated on create. */
  employee_id: string;
  /** Sign-in account link: set at create (email upfront, uid after the
   * Auth account exists). Used to propagate archive/deactivate to the
   * users/{uid} doc so login is blocked. Legacy rows may lack both. */
  email?: string;
  uid?: string;
  /** Archived HR records leave the roster (Archived tab) and always
   * carry status "inactive" so sign-in stays blocked. */
  archived?: boolean;
  fname: string;
  initial?: string; // middle initial, e.g. "A." - single letter w/ optional dot
  lname: string;
  contact_number: string;
  /** ISO YYYY-MM-DD. The on-document source of truth for the derived `age`. */
  birthdate?: string;
  /** Derived from `birthdate` on read/write. Kept on the doc so tables and
   *  legacy rows (without a `birthdate` yet) can still show the value. */
  age: number;
  gender: EmployeeGender;
  address?: UserAddress;
  role: EmployeeRole;
  status: "active" | "inactive";
  created_at?: string;
  updated_at?: string;
}
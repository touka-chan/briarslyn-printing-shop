"use client";

type StatusVariant = 
 | "pending" 
 | "in-production" 
 | "ready for pickup"
 | "ready"
 | "completed" 
 | "cancelled"
 | "in-stock"
 | "low-stock"
 | "insufficient-stock"
 | "insufficient stock"
 | "out-of-stock"
 | "active"
 | "inactive"
 | "overdue"
 | "urgent"
 | "upcoming";

const statusConfig: Record<StatusVariant, { label: string; className: string }> = {
 pending: { label: "Pending", className: "status-badge status-pending" },
 "in-production": { label: "In Production", className: "status-badge status-in-production" },
 "ready for pickup": { label: "Ready for Pickup", className: "status-badge status-ready" },
 ready: { label: "Ready", className: "status-badge status-ready" },
 completed: { label: "Completed", className: "status-badge status-completed" },
 cancelled: { label: "Cancelled", className: "status-badge status-cancelled" },
 "in-stock": { label: "In Stock", className: "status-badge status-ready" },
 "low-stock": { label: "Low Stock", className: "status-badge status-pending" },
 "insufficient-stock": { label: "Insufficient Stock", className: "status-badge status-cancelled" },
 "insufficient stock": { label: "Insufficient Stock", className: "status-badge status-cancelled" },
 "out-of-stock": { label: "Out of Stock", className: "status-badge status-cancelled" },
 active: { label: "Active", className: "status-badge status-ready" },
 inactive: { label: "Inactive", className: "status-badge status-cancelled" },
 overdue: { label: "Overdue", className: "status-badge status-cancelled" },
 urgent: { label: "Urgent", className: "status-badge status-pending" },
 upcoming: { label: "Upcoming", className: "status-badge status-in-production" },
};

interface StatusBadgeProps {
 status: StatusVariant;
 customLabel?: string;
 className?: string;
}

export function StatusBadge({ status, customLabel, className = "" }: StatusBadgeProps) {
 const key = status.toLowerCase() as StatusVariant;
 const config = statusConfig[key] ?? { label: customLabel || status, className: "status-badge status-pending" };
 return (
  <span className={`${config.className} ${className}`}>
   {customLabel || config.label}
  </span>
 );
}

export function getStatusConfig(status: StatusVariant) {
 return statusConfig[status.toLowerCase() as StatusVariant];
}
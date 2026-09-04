import { ReactNode } from "react";

export type Priority = "overdue" | "urgent" | "upcoming";

interface PriorityBadgeProps {
 priority: Priority;
 children?: ReactNode;
 className?: string;
 showDot?: boolean;
}

const CONFIG: Record<Priority, { label: string; className: string; dot: string }> = {
 overdue: {
  label: "Overdue",
  className: "priority-overdue",
  dot: "bg-printflow-error",
 },
 urgent: {
  label: "Urgent",
  className: "priority-urgent",
  dot: "bg-printflow-warning",
 },
 upcoming: {
  label: "Upcoming",
  className: "priority-upcoming",
  dot: "bg-printflow-on-surface-variant/60",
 },
};

export function PriorityBadge({
 priority,
 children,
 className = "",
 showDot = true,
}: PriorityBadgeProps) {
 const config = CONFIG[priority];
 return (
  <span
   className={`status-badge ${config.className} ${className}`.trim()}
   aria-label={`Priority: ${config.label}`}
  >
   {showDot && (
    <span
     className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`}
     aria-hidden="true"
    />
   )}
   {children ?? config.label}
  </span>
 );
}

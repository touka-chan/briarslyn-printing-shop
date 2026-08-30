"use client";

import { KpiData } from "@/types";
import { Icon, IconName } from "./Icon";

interface KpiCardProps extends Omit<KpiData, "icon"> {
 icon?: IconName | React.ReactNode;
 className?: string;
 onClick?: () => void;
}

export function KpiCard({ label, value, change, changeType, icon, trend, className = "", onClick }: KpiCardProps) {
 return (
  <div onClick={onClick} className={`kpi-card ${className} ${onClick ? "cursor-pointer hover:shadow-md hover:border-printflow-primary/30 transition-all active:scale-[0.98]" : ""}`}>
   <div className="flex items-start justify-between">
    <div className="flex-1">
     <p className="text-sm font-medium text-printflow-on-surface-variant mb-1">{label}</p>
     <p className="text-3xl font-bold text-printflow-on-surface tabular-nums">{value}</p>
      {change && (
       <div className="flex items-center gap-1.5 mt-2">
        <span className={`text-sm font-medium ${
         changeType === "positive" ? "text-printflow-success" :
         changeType === "negative" ? "text-printflow-error" :
         "text-printflow-on-surface-variant"
        }`}>
         {trend && trend !== "stable" ? (trend === "up" ? "↑ " : "↓ ") : "→ "}{change}
        </span>
        {trend && trend !== "stable" && changeType !== "neutral" && (
          <span className="text-xs text-printflow-on-surface-variant">vs last period</span>
        )}
       </div>
      )}
    </div>
    <div className="p-3 bg-printflow-primary-fixed/20 rounded-xl text-printflow-primary">
     {typeof icon === "string" && <Icon name={icon as IconName} />}
     {typeof icon !== "string" && icon}
    </div>
   </div>
  </div>
 );
}
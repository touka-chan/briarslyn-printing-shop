"use client";

import { KpiData } from "@/types";
import { Icon, IconName } from "./Icon";

interface KpiCardProps extends Omit<KpiData, "icon"> {
 icon?: IconName | React.ReactNode;
 className?: string;
 onClick?: () => void;
 sparkline?: number[];
 sparklineTone?: "primary" | "success" | "warning" | "error" | "neutral";
 lastUpdated?: string;
}

function Sparkline({
 data,
 tone = "primary",
 width = 96,
 height = 32,
}: {
 data: number[];
 tone?: "primary" | "success" | "warning" | "error" | "neutral";
 width?: number;
 height?: number;
}) {
 if (!data || data.length < 2) return null;
 const min = Math.min(...data);
 const max = Math.max(...data);
 const range = max - min || 1;
 const stepX = width / (data.length - 1);
 const points = data
  .map((v, i) => {
   const x = i * stepX;
   const y = height - ((v - min) / range) * (height - 2) - 1;
   return `${x.toFixed(1)},${y.toFixed(1)}`;
  })
  .join(" ");

 const areaPath = `M0,${height} L ${points.split(" ").join(" L ")} L ${width},${height} Z`;

 const colorClass = {
  primary: "text-printflow-primary",
  success: "text-printflow-success",
  warning: "text-printflow-warning",
  error: "text-printflow-error",
  neutral: "text-printflow-on-surface-variant",
 }[tone];

 const fillClass = {
  primary: "fill-printflow-primary/15",
  success: "fill-printflow-success/15",
  warning: "fill-printflow-warning/15",
  error: "fill-printflow-error/15",
  neutral: "fill-printflow-on-surface-variant/10",
 }[tone];

 return (
  <svg
   width={width}
   height={height}
   viewBox={`0 0 ${width} ${height}`}
   className={`kpi-sparkline ${colorClass}`}
   aria-hidden="true"
   preserveAspectRatio="none"
  >
   <path d={areaPath} className={fillClass} />
   <polyline
    points={points}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    vectorEffect="non-scaling-stroke"
   />
  </svg>
 );
}

export function KpiCard({
 label,
 value,
 change,
 changeType,
 icon,
 trend,
 className = "",
 onClick,
 sparkline,
 sparklineTone = "primary",
 lastUpdated,
}: KpiCardProps) {
 return (
  <div
   onClick={onClick}
   className={`kpi-card ${className} ${onClick ? "cursor-pointer hover:shadow-md hover:border-printflow-primary/30 transition-all active:scale-[0.98]" : ""}`}
  >
   <div className="flex items-start justify-between gap-3">
    <div className="flex-1 min-w-0">
     <p className="text-sm font-medium text-printflow-on-surface-variant mb-1 truncate">
      {label}
     </p>
     <p className="text-3xl font-bold text-printflow-on-surface tabular-nums">
      {value}
     </p>
     {change && (
      <div className="flex items-center gap-1.5 mt-2">
       <span
        className={`text-sm font-medium ${
         changeType === "positive"
          ? "text-printflow-success"
          : changeType === "negative"
            ? "text-printflow-error"
            : "text-printflow-on-surface-variant"
        }`}
       >
        {trend && trend !== "stable" ? (trend === "up" ? "↑ " : "↓ ") : "→ "}
        {change}
       </span>
       {trend && trend !== "stable" && changeType !== "neutral" && (
        <span className="text-xs text-printflow-on-surface-variant">
         vs last period
        </span>
       )}
      </div>
     )}
     {lastUpdated && (
      <p className="mt-2 text-[11px] text-printflow-on-surface-variant/80 tabular-nums">
       {lastUpdated}
      </p>
     )}
    </div>
    <div className="flex flex-col items-end gap-2 shrink-0">
     <div className="p-3 bg-printflow-primary-fixed/20 rounded-xl text-printflow-primary">
      {typeof icon === "string" && <Icon name={icon as IconName} />}
      {typeof icon !== "string" && icon}
     </div>
     {sparkline && sparkline.length > 1 && (
      <Sparkline data={sparkline} tone={sparklineTone} />
     )}
    </div>
   </div>
  </div>
 );
}

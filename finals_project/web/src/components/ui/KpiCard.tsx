"use client";

import { KpiData } from "@/types";
import { CountUp } from "./CountUp";
import { Icon, IconName } from "./Icon";

interface KpiCardProps extends Omit<KpiData, "icon"> {
 icon?: IconName | React.ReactNode;
 className?: string;
 onClick?: () => void;
 /** Optional 7-14 day series rendered as a thin sparkline under the value. */
 sparkline?: number[];
 /** Sparkline accent color - uses existing printflow tokens only. */
 sparklineTone?: "primary" | "success" | "warning" | "error";
 /** Tiny "last updated" footnote (e.g. "Live" or "Aug 28"). */
 lastUpdated?: string;
}

const TONE_STROKE: Record<NonNullable<KpiCardProps["sparklineTone"]>, string> = {
 primary: "var(--color-printflow-primary)",
 success: "var(--color-printflow-success)",
 warning: "var(--color-printflow-warning)",
 error: "var(--color-printflow-error)",
};

const TONE_FILL: Record<NonNullable<KpiCardProps["sparklineTone"]>, string> = {
 primary: "var(--color-printflow-primary)",
 success: "var(--color-printflow-success)",
 warning: "var(--color-printflow-warning)",
 error: "var(--color-printflow-error)",
};

/**
 * Renders a 7-point sparkline from a numeric series.
 * Geometry: 80x24 SVG, padding-aware, normalizes to range with a 1-unit
 * floor so a fully-flat series still draws a visible (flat) line instead
 * of disappearing into the top edge.
 */
function Sparkline({ data, tone }: { data: number[]; tone: keyof typeof TONE_STROKE }) {
 if (!data || data.length < 2) return null;
 const W = 80;
 const H = 24;
 const PAD_X = 2;
 const PAD_Y = 3;
 const innerW = W - PAD_X * 2;
 const innerH = H - PAD_Y * 2;
 const min = Math.min(...data);
 const max = Math.max(...data);
 const range = max - min || 1;
 const stepX = innerW / (data.length - 1);

 const points = data
  .map((v, i) => {
   const x = PAD_X + i * stepX;
   const y = PAD_Y + innerH - ((v - min) / range) * innerH;
   return `${x.toFixed(2)},${y.toFixed(2)}`;
  })
  .join(" ");

 const lastX = PAD_X + (data.length - 1) * stepX;
 const lastY =
  PAD_Y + innerH - ((data[data.length - 1] - min) / range) * innerH;

 const areaPath = `M ${PAD_X},${H - PAD_Y} L ${points
  .split(" ")
  .map((p) => p)
  .join(" L ")} L ${lastX.toFixed(2)},${H - PAD_Y} Z`;

 const stroke = TONE_STROKE[tone];
 const fill = TONE_FILL[tone];

 return (
  <svg
   width={W}
   height={H}
   viewBox={`0 0 ${W} ${H}`}
   className="block"
   aria-hidden
   role="presentation"
  >
   <path d={areaPath} fill={fill} fillOpacity={0.10} />
   <polyline
    points={points}
    fill="none"
    stroke={stroke}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
   />
   <circle
    cx={lastX}
    cy={lastY}
    r={1.75}
    fill={stroke}
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
 sparkline,
 sparklineTone = "primary",
 lastUpdated,
 className = "",
 onClick,
}: KpiCardProps) {
 return (
  <div
   onClick={onClick}
   className={`kpi-card ${className} ${
    onClick
     ? "cursor-pointer hover:shadow-md hover:border-printflow-primary/30 transition-all active:scale-[0.98]"
     : ""
   }`}
  >
   <div className="flex items-start justify-between gap-3">
    <div className="flex-1 min-w-0">
     <p className="text-sm font-medium text-printflow-on-surface-variant mb-1">
      {label}
     </p>
       <p className="font-display text-3xl font-bold text-printflow-on-surface tabular-nums">
        <CountUp value={value} />
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
         {trend && trend !== "stable" ? (trend === "up" ? "Up " : "Down ") : "Flat "}
        {change}
       </span>
       {trend && trend !== "stable" && changeType !== "neutral" && (
        <span className="text-xs text-printflow-on-surface-variant">
         vs last period
        </span>
       )}
      </div>
     )}
     {(sparkline || lastUpdated) && (
      <div className="mt-2 flex items-center gap-2 min-w-0">
       {sparkline && <Sparkline data={sparkline} tone={sparklineTone} />}
       {lastUpdated && (
        <span className="text-[10px] uppercase tracking-wide text-printflow-on-surface-variant/70 shrink-0">
         {lastUpdated}
        </span>
       )}
      </div>
     )}
    </div>
     <div className="p-3 bg-black/[0.05] dark:bg-white/10 rounded-xl text-black dark:text-white shrink-0">
     {typeof icon === "string" && <Icon name={icon as IconName} />}
     {typeof icon !== "string" && icon}
    </div>
   </div>
  </div>
 );
}

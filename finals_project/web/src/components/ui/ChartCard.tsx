"use client";

import { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { EmptyState } from "./EmptyState";
import {
 LineChart,
 Line,
 AreaChart,
 Area,
 BarChart,
 Bar,
 PieChart,
 Pie,
 Cell,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer,
} from "recharts";

interface ChartDataPoint {
 name: string;
 [key: string]: string | number;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  type: "line" | "area" | "bar" | "pie";
  data: ChartDataPoint[];
  xKey: string;
  yKeys: string[];
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  children?: ReactNode;
  className?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  /** First-load shimmer: renders a skeleton block instead of the chart. */
  loading?: boolean;
}

/**
 * Monochrome data ramp (reference-style) driven by theme tokens, so
 * charts stay readable in light + dark without hardcoded hexes.
 */
const CHART_COLORS = [
  "var(--color-printflow-on-surface)",
  "var(--color-printflow-on-surface-variant)",
  "var(--color-printflow-outline)",
  "var(--color-printflow-outline-variant)",
  "var(--color-printflow-on-surface)",
  "var(--color-printflow-on-surface-variant)",
];

const TEXT_COLOR = "var(--color-printflow-on-surface-variant)";
const GRID_COLOR = "var(--color-printflow-outline-variant)";

export function ChartCard({
  title,
  subtitle,
  type,
  data,
  xKey,
  yKeys,
  colors = CHART_COLORS,
  height = 300,
  showLegend = true,
  showGrid = true,
  children,
  className = "",
  emptyMessage = "No data yet",
  emptyDescription = "Data will appear here once there is activity.",
  loading = false,
}: ChartCardProps) {
  // Degenerate renders (empty array, or every value zero) produce
  // misleading artifacts in some chart types - show an intentional
  // empty state instead. This also covers fresh/emptied databases.
  const hasData =
   Array.isArray(data) &&
   data.length > 0 &&
   yKeys.some((k) => data.some((d) => Number(d[k]) > 0));
 const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length) {
   return (
    <div className="bg-printflow-surface border border-printflow-outline-variant rounded-lg shadow-lg p-3 min-w-[160px]">
     <p className="font-medium text-printflow-on-surface mb-2">{label}</p>
     {payload.map((entry, index) => (
      <p key={index} className="text-sm flex items-center gap-2">
       <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
       <span className="font-medium">{entry.name}: </span>
       <span className="text-printflow-on-surface-variant">{entry.value.toLocaleString()}</span>
      </p>
     ))}
    </div>
   );
  }
  return null;
 };

 const renderChart = () => {
  const commonProps = {
   data,
   margin: { top: 10, right: 30, left: 0, bottom: 0 },
  };

  const axisTick = { fill: TEXT_COLOR, fontSize: 12 };

  switch (type) {
   case "line":
    return (
     <LineChart {...commonProps}>
      {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />}
      <XAxis dataKey={xKey} tick={axisTick} axisLine={false} tickLine={false} />
      <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
      <Tooltip content={<CustomTooltip />} />
      {showLegend && <Legend />}
      {yKeys.map((key, index) => (
       <Line key={key} type="monotone" dataKey={key} stroke={colors[index % colors.length]} strokeWidth={2} dot={false} activeDot={{ r: 6, strokeWidth: 2 }} />
      ))}
     </LineChart>
    );

   case "area":
    return (
     <AreaChart {...commonProps}>
      {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />}
      <XAxis dataKey={xKey} tick={axisTick} axisLine={false} tickLine={false} />
      <YAxis tick={axisTick} axisLine={false} tickLine={false} />
      <Tooltip content={<CustomTooltip />} />
      {showLegend && <Legend />}
      {yKeys.map((key, index) => (
       <Area key={key} type="monotone" dataKey={key} stroke={colors[index % colors.length]} fill={colors[index % colors.length]} fillOpacity={0.15} strokeWidth={2} />
      ))}
     </AreaChart>
    );

   case "bar":
    return (
     <BarChart {...commonProps}>
      {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />}
      <XAxis dataKey={xKey} tick={axisTick} axisLine={false} tickLine={false} />
      <YAxis tick={axisTick} axisLine={false} tickLine={false} />
      <Tooltip content={<CustomTooltip />} />
      {showLegend && <Legend />}
      {yKeys.map((key, index) => (
       <Bar key={key} dataKey={key} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} />
      ))}
     </BarChart>
    );

   case "pie":
    return (
     <PieChart margin={{ top: 5, right: 5, bottom: 35, left: 5 }}>
      <Pie data={data} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey={yKeys[0]} nameKey={xKey} labelLine={false} label={false}>
       {data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} stroke="var(--color-printflow-surface)" strokeWidth={2} />)}
      </Pie>
      <Tooltip content={<CustomTooltip />} />
      {showLegend && <Legend verticalAlign="bottom" align="center" iconSize={10} wrapperStyle={{ fontSize: "12px", lineHeight: "16px", paddingTop: "8px" }} />}
     </PieChart>
    );

   default:
    return null;
  }
 };

  return (
   <div className={`chart-card ${className}`}>
    {(title || subtitle) && (
     <div className="mb-6">
      <h3 className="text-lg font-semibold text-printflow-on-surface">{title}</h3>
      {subtitle && <p className="text-sm text-printflow-on-surface-variant mt-0.5">{subtitle}</p>}
     </div>
    )}
    {loading ? (
     <div style={{ height }} className="w-full" aria-busy="true">
      <div className="loading-skeleton h-full w-full rounded-xl" />
     </div>
    ) : !hasData ? (
     <div style={{ height }} className="w-full flex items-center justify-center">
      <EmptyState
       icon={<Inbox className="w-7 h-7" />}
       title={emptyMessage}
       description={emptyDescription}
      />
     </div>
    ) : (
     <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
       {renderChart()}
      </ResponsiveContainer>
     </div>
    )}
    {children}
   </div>
  );
}
"use client";

import { ReactNode } from "react";
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
}

const CHART_COLORS = [
 "#00535b",
 "#a8372c",
 "#00479b",
 "#2e7d32",
 "#ed6c02",
 "#8b5cf6",
];

const TEXT_COLOR = "#3e494a";
const GRID_COLOR = "#bec8ca";

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
}: ChartCardProps) {
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
   margin: { top: 16, right: 24, left: 8, bottom: 12 },
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
       {data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} stroke="#fff" strokeWidth={2} />)}
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
   <div style={{ height }} className="w-full">
    <ResponsiveContainer width="100%" height="100%">
     {renderChart()}
    </ResponsiveContainer>
   </div>
   {children}
  </div>
 );
}
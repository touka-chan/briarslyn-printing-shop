"use client";

import { TableColumn } from "@/types";

interface DataTableProps<T> {
 columns: TableColumn<T>[];
 data: T[];
 keyExtractor: (row: T) => string;
 onRowClick?: (row: T) => void;
 emptyMessage?: string;
 loading?: boolean;
 className?: string;
}

export function DataTable<T>({
 columns,
 data,
 keyExtractor,
 onRowClick,
 emptyMessage = "No data available",
 loading = false,
 className = "",
}: DataTableProps<T>) {
 if (loading) {
  return (
   <div className="overflow-x-auto">
    <table className="data-table">
     <thead>
      <tr>
       {columns.map((col) => (
        <th key={String(col.key)} className={col.className}>{col.header}</th>
       ))}
      </tr>
     </thead>
     <tbody>
      {[...Array(5)].map((_, i) => (
       <tr key={i}>
        {columns.map((col) => (
         <td key={String(col.key)} className={col.className}>
          <div className="loading-skeleton h-4 w-3/4" />
         </td>
        ))}
       </tr>
      ))}
     </tbody>
    </table>
   </div>
  );
 }

 if (data.length === 0) {
  return (
   <div className="empty-state">
    <div className="empty-state-icon w-12 h-12 rounded-full bg-printflow-surface-container flex items-center justify-center">
     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
     </svg>
    </div>
    <p className="empty-state-title">No Data Found</p>
    <p className="empty-state-description">{emptyMessage}</p>
   </div>
  );
 }

 return (
  <div className={`overflow-x-auto ${className}`}>
   <table className="data-table">
    <thead>
     <tr>
      {columns.map((col) => (
       <th key={String(col.key)} className={col.className}>{col.header}</th>
      ))}
     </tr>
    </thead>
    <tbody>
     {data.map((row) => (
      <tr key={keyExtractor(row)} className={onRowClick ? "cursor-pointer" : ""} onClick={() => onRowClick?.(row)}>
       {columns.map((col) => (
        <td key={String(col.key)} className={col.className}>
         {col.render ? col.render(row) : String(row[col.key as keyof T] ?? "")}
        </td>
       ))}
      </tr>
     ))}
    </tbody>
   </table>
  </div>
 );
}
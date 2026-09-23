"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TableColumn } from "@/types";

interface DataTableProps<T> {
 columns: TableColumn<T>[];
 data: T[];
 keyExtractor: (row: T) => string;
 onRowClick?: (row: T) => void;
 emptyMessage?: string;
 loading?: boolean;
 className?: string;
  /** When set, only this many rows render per page with a pager footer. */
  pageSize?: number;
  /**
   * When false, the table never creates a bottom (horizontal) scrollbar —
   * the wrapper clips instead of scrolling. Use inside modals where the
   * table must fit full-view. Defaults to true (pages keep mobile scroll).
   */
  scrollable?: boolean;
 /**
  * Collapsed preview: show only the first N rows with a "Show more"
  * expander (default 10). Set to 0 to disable the preview and always
  * render the full list.
  */
 previewLimit?: number;
}

export function DataTable<T>({
 columns,
 data,
 keyExtractor,
 onRowClick,
 emptyMessage = "No data available",
 loading = false,
 className = "",
 pageSize,
 previewLimit = 10,
 scrollable = true,
}: DataTableProps<T>) {
 const [page, setPage] = useState(0);
 const [expanded, setExpanded] = useState(false);
 const paginated = !!pageSize && pageSize > 0;
 // Collapsed when the list exceeds the preview budget (and preview on).
 const collapsed =
  previewLimit > 0 && data.length > previewLimit && !expanded;
 const totalPages = paginated
  ? Math.max(1, Math.ceil(data.length / (pageSize as number)))
  : 1;
 // Derived clamp (no effect): filtering/searching can shrink the list
 // under the stored page; render from the clamped page instead.
 const safePage = Math.min(Math.max(0, page), totalPages - 1);
 const fullRows = paginated
  ? data.slice(safePage * (pageSize as number), safePage * (pageSize as number) + (pageSize as number))
  : data;
 const rows = collapsed ? data.slice(0, previewLimit) : fullRows;
 const rangeStart = data.length === 0 ? 0 : safePage * (pageSize as number) + 1;
 const rangeEnd = paginated
  ? Math.min(data.length, safePage * (pageSize as number) + (pageSize as number))
  : data.length;

  if (loading) {
   return (
    <div className={scrollable ? "overflow-x-auto" : "overflow-x-clip max-w-full"}>
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
    <div className={className}>
     <div className={scrollable ? "overflow-x-auto" : "overflow-x-clip max-w-full"}>
      <table className="data-table">
      <thead>
       <tr>
        {columns.map((col) => (
         <th key={String(col.key)} className={col.className}>{col.header}</th>
        ))}
       </tr>
      </thead>
      <tbody>
       {rows.map((row) => (
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
     {(collapsed || (paginated && totalPages > 1)) && (
      <div className="flex items-center justify-between gap-3 px-1 pt-3 text-sm text-printflow-on-surface-variant print:hidden">
       <p>
        {collapsed
         ? `Showing latest ${rows.length} of ${data.length}`
         : `Showing ${rangeStart}-${rangeEnd} of ${data.length}`}
       </p>
       <div className="flex items-center gap-2">
        {collapsed ? (
         <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-printflow-outline-variant/60 font-medium text-printflow-on-surface hover:bg-printflow-surface-container transition-colors"
         >
          Show all {data.length - rows.length} more
          <ChevronDown className="w-4 h-4" />
         </button>
        ) : (
         <>
          {previewLimit > 0 && data.length > previewLimit && (
           <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-printflow-outline-variant/60 hover:bg-printflow-surface-container transition-colors"
           >
            Show less
            <ChevronDown className="w-4 h-4 rotate-180" />
           </button>
          )}
          {paginated && totalPages > 1 && (
           <>
            <button
             type="button"
             disabled={safePage === 0}
             onClick={() => setPage((p) => Math.max(0, p - 1))}
             className="px-3 py-1.5 rounded-lg border border-printflow-outline-variant/60 disabled:opacity-40 hover:bg-printflow-surface-container"
            >
             Prev
            </button>
            <span>
             Page {safePage + 1} of {totalPages}
            </span>
            <button
             type="button"
             disabled={safePage >= totalPages - 1}
             onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
             className="px-3 py-1.5 rounded-lg border border-printflow-outline-variant/60 disabled:opacity-40 hover:bg-printflow-surface-container"
            >
             Next
            </button>
           </>
          )}
         </>
        )}
       </div>
      </div>
     )}
   </div>
  );
}
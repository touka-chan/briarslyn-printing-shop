"use client";

import { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
 icon?: ReactNode;
 title: string;
 description?: string;
 action?: ReactNode;
 className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
 return (
  <div className={`empty-state ${className}`}>
   <div className="empty-state-icon w-16 h-16 rounded-full bg-printflow-surface-container flex items-center justify-center">
    {icon || (
     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
     </svg>
    )}
   </div>
   <h3 className="empty-state-title">{title}</h3>
   {description && <p className="empty-state-description">{description}</p>}
   {action && <div className="mt-6">{action}</div>}
  </div>
 );
}

interface LoadingStateProps {
 variant?: "skeleton" | "spinner" | "overlay";
 className?: string;
}

export function LoadingState({ variant = "skeleton", className = "" }: LoadingStateProps) {
 if (variant === "spinner") {
  return (
   <div className={`flex items-center justify-center py-12 ${className}`}>
    <svg className="animate-spin h-8 w-8 text-printflow-primary" viewBox="0 0 24 24">
     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
   </div>
  );
 }

 if (variant === "overlay") {
  return (
   <div className={`fixed inset-0 bg-printflow-bg/80 flex items-center justify-center z-50 ${className}`}>
    <svg className="animate-spin h-12 w-12 text-printflow-primary" viewBox="0 0 24 24">
     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
   </div>
  );
 }

 return (
  <div className={className}>
   <div className="loading-skeleton h-4 w-3/4 mb-3 rounded" />
   <div className="loading-skeleton h-4 w-1/2 mb-3 rounded" />
   <div className="loading-skeleton h-4 w-1/3 rounded" />
  </div>
 );
}

interface CardSkeletonProps {
 className?: string;
}

export function CardSkeleton({ className = "" }: CardSkeletonProps) {
 return (
  <div className={`content-card ${className}`}>
   <div className="p-6 space-y-4">
    <div className="loading-skeleton h-6 w-1/4 rounded" />
    <div className="loading-skeleton h-12 w-full rounded" />
    <div className="grid grid-cols-3 gap-4">
     <div className="loading-skeleton h-16 rounded-lg" />
     <div className="loading-skeleton h-16 rounded-lg" />
     <div className="loading-skeleton h-16 rounded-lg" />
    </div>
   </div>
  </div>
 );
}

interface TableSkeletonProps {
 rows?: number;
 columns?: number;
 className?: string;
}

export function TableSkeleton({ rows = 5, columns = 5, className = "" }: TableSkeletonProps) {
 return (
  <div className={`overflow-x-auto ${className}`}>
   <table className="data-table">
    <thead>
     <tr>
      {[...Array(columns)].map((_, i) => (
       <th key={i}>
        <div className="loading-skeleton h-4 w-24 rounded" />
       </th>
      ))}
     </tr>
    </thead>
    <tbody>
     {[...Array(rows)].map((_, i) => (
      <tr key={i}>
       {[...Array(columns)].map((_, j) => (
        <td key={j}>
         <div className="loading-skeleton h-4 w-20 rounded" />
        </td>
       ))}
      </tr>
     ))}
    </tbody>
   </table>
  </div>
 );
}
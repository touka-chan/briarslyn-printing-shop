"use client";

import { ReactNode } from "react";

interface ContentCardProps {
 title?: string;
 subtitle?: string;
 action?: ReactNode;
 children: ReactNode;
 className?: string;
 headerClassName?: string;
}

export function ContentCard({ title, subtitle, action, children, className = "", headerClassName = "" }: ContentCardProps) {
 return (
  <div className={`content-card ${className}`}>
   {(title || action) && (
    <div className={`px-6 py-4 border-b border-printflow-outline-variant flex items-center justify-between ${headerClassName}`}>
     <div>
      {title && <h3 className="text-lg font-semibold text-printflow-on-surface">{title}</h3>}
      {subtitle && <p className="text-sm text-printflow-on-surface-variant mt-0.5">{subtitle}</p>}
     </div>
     {action && <div>{action}</div>}
    </div>
   )}
   <div className="p-6">
    {children}
   </div>
  </div>
 );
}
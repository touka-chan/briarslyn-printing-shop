"use client";

import { useState, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
 Factory,
 Menu,
 X,
} from "lucide-react";

interface NavItem {
 label: string;
 href: string;
 badge?: string | number;
}

const navigation: NavItem[] = [
 { label: "Dashboard", href: "/dashboard" },
 { label: "Orders", href: "/orders", badge: 12 },
 { label: "Production", href: "/production", badge: 5 },
 { label: "Inventory", href: "/inventory", badge: 8 },
 { label: "Analytics", href: "/analytics" },
 { label: "Forecasting", href: "/forecasting" },
 { label: "Reports", href: "/reports" },
 { label: "Users", href: "/users" },
 { label: "Settings", href: "/settings" },
];

export function Sidebar() {
 const pathname = usePathname();

 return (
  <aside className="sidebar" aria-label="Main navigation">
   <div className="flex flex-col h-full">
    {/* Logo */}
    <div className="flex items-center h-16 px-4 border-b border-printflow-outline-variant">
     <Link href="/dashboard" className="flex items-center gap-3" aria-label="PrintFlow Dashboard">
      <div className="w-8 h-8 bg-printflow-primary rounded-lg flex items-center justify-center">
       <Factory className="w-5 h-5 text-printflow-on-primary" />
      </div>
      <span className="font-bold text-lg text-printflow-on-surface">PrintFlow</span>
     </Link>
    </div>

    {/* Navigation */}
    <nav className="flex-1 py-4 overflow-y-auto" aria-label="Main navigation">
     <ul className="space-y-1 px-3" role="list">
      {navigation.map((item) => {
       const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
       return (
        <li key={item.href}>
         <Link
          href={item.href}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
           isActive
            ? "bg-printflow-primary text-printflow-on-primary"
            : "text-printflow-on-surface-variant hover:bg-printflow-surface-container hover:text-printflow-on-surface"
          }`}
          aria-current={isActive ? "page" : undefined}
         >
          <span className="font-medium truncate">{item.label}</span>
          {item.badge && (
           <span className="ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-printflow-primary-fixed/30 text-printflow-primary">
            {item.badge}
           </span>
          )}
         </Link>
        </li>
       );
      })}
     </ul>
    </nav>

    {/* Footer */}
    <div className="p-4 border-t border-printflow-outline-variant">
     <p className="text-xs text-center text-printflow-on-surface-variant">All rights reserved 2026</p>
    </div>
   </div>
  </aside>
 );
}

export function MobileSidebarTrigger({ onClick }: { onClick: () => void }) {
 return (
  <button
   onClick={onClick}
   className="btn-ghost p-2 lg:hidden"
   aria-label="Open navigation menu"
  >
   <Menu className="w-6 h-6" />
  </button>
 );
}

export function MobileSidebarOverlay({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: ReactNode }) {
 if (!isOpen) return null;

 return (
  <>
   <div
    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
    onClick={onClose}
    aria-hidden="true"
   />
   <aside className="sidebar w-64 z-50 lg:hidden transform transition-transform duration-300 ease-in-out">
    {children}
    <button
     onClick={onClose}
     className="absolute top-4 right-4 btn-ghost p-2 lg:hidden"
     aria-label="Close navigation menu"
    >
     <X className="w-5 h-5" />
    </button>
   </aside>
  </>
 );
}
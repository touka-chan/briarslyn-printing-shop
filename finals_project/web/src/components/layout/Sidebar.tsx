"use client";

import { useState, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
 Factory,
 Menu,
 X,
 LayoutDashboard,
 ShoppingCart,
 Package,
 TrendingUp,
 BarChart3,
 FileText,
 Banknote,
 Users,
 UserCheck,
 Settings,
} from "lucide-react";
import { mockOrders, mockInventory, mockProduction, mockSales, mockUsers } from "@/lib/mockData";

interface NavItem {
 label: string;
 href: string;
 icon: ReactNode;
 badge?: number;
}

export function Sidebar() {
 const pathname = usePathname();

 const orderCount = mockOrders.filter(
  (o) => o.status !== "Completed",
 ).length;
 const productionCount = mockProduction.length;
 const inventoryCount = mockInventory.length;
 const employeeCount = mockUsers.filter(
  (u) => u.role !== "Owner",
 ).length;

 const main: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
  { label: "Orders", href: "/orders", icon: <ShoppingCart className="w-5 h-5 shrink-0" />, badge: orderCount },
  { label: "Production", href: "/production", icon: <Factory className="w-5 h-5 shrink-0" />, badge: productionCount },
  { label: "Inventory", href: "/inventory", icon: <Package className="w-5 h-5 shrink-0" />, badge: inventoryCount },
 ];

 const insights: NavItem[] = [
  { label: "Analytics", href: "/analytics", icon: <BarChart3 className="w-5 h-5 shrink-0" /> },
  { label: "Sales", href: "/sales", icon: <Banknote className="w-5 h-5 shrink-0" />, badge: mockSales.length },
  { label: "Forecasting", href: "/forecasting", icon: <TrendingUp className="w-5 h-5 shrink-0" /> },
  { label: "Reports", href: "/reports", icon: <FileText className="w-5 h-5 shrink-0" /> },
 ];

 const account: NavItem[] = [
  { label: "Users", href: "/users", icon: <Users className="w-5 h-5 shrink-0" /> },
  { label: "Employees", href: "/employees", icon: <UserCheck className="w-5 h-5 shrink-0" />, badge: employeeCount },
  { label: "Settings", href: "/settings", icon: <Settings className="w-5 h-5 shrink-0" /> },
 ];

 const renderGroup = (heading: string, items: NavItem[]) => (
  <div className="mb-4">
   <p className="px-3 mb-2 type-label uppercase tracking-wider text-printflow-on-surface-variant/70">
    {heading}
   </p>
   <ul className="space-y-1" role="list">
    {items.map((item) => {
     const isActive =
      pathname === item.href || pathname.startsWith(item.href + "/");
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
        aria-label={
         item.badge ? `${item.label} (${item.badge})` : item.label
        }
       >
        {item.icon}
        <span className="font-medium truncate">{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
         <span
          className={`ml-auto px-2 py-0.5 text-xs font-semibold rounded-full ${
           isActive
            ? "bg-printflow-on-primary/20 text-printflow-on-primary"
            : "bg-printflow-primary-fixed/30 text-printflow-primary"
          }`}
         >
          {item.badge}
         </span>
        )}
       </Link>
      </li>
     );
    })}
   </ul>
  </div>
 );

 return (
  <aside className="sidebar" aria-label="Main navigation">
   <div className="flex flex-col h-full">
    {/* Logo */}
    <div className="flex items-center h-16 px-4 border-b border-printflow-outline-variant">
     <Link
      href="/dashboard"
      className="flex items-center gap-3"
      aria-label="PrintFlow Dashboard"
     >
      <div className="w-8 h-8 bg-printflow-primary rounded-lg flex items-center justify-center">
       <Factory className="w-5 h-5 text-printflow-on-primary" />
      </div>
      <span className="font-bold text-lg text-printflow-on-surface">
       PrintFlow
      </span>
     </Link>
    </div>

    {/* Navigation */}
    <nav
     className="flex-1 py-4 overflow-y-auto scrollbar-thin"
     aria-label="Main navigation"
    >
     <div className="px-3">
      {renderGroup("Main", main)}
      {renderGroup("Insights", insights)}
      {renderGroup("Account", account)}
     </div>
    </nav>

    {/* Footer */}
    <div className="p-4 border-t border-printflow-outline-variant">
     <p className="text-xs text-center text-printflow-on-surface-variant">
      Brialyns Art Sign · v1.0
     </p>
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

export function MobileSidebarOverlay({
 isOpen,
 onClose,
 children,
}: {
 isOpen: boolean;
 onClose: () => void;
 children: ReactNode;
}) {
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

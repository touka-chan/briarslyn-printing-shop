"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Poppins } from "next/font/google";
import {
  Factory,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  TrendingUp,
  Banknote,
  FileText,
  Users,
  Settings,
  Briefcase,
  ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSidebarCollapsed } from "@/lib/hooks/useSidebarCollapsed";

/** Bold display face for the wordmark (sidebar only, self-hosted). */
const poppins = Poppins({ subsets: ["latin"], weight: ["700", "800"] });

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Only shown to this role (e.g. Audit Log is Owner-only). */
  ownerOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
   title: "Main",
   items: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
   ],
  },
  {
   title: "Operations",
   items: [
    { label: "Orders", href: "/orders", icon: ShoppingCart },
    { label: "Production", href: "/production", icon: Factory },
    { label: "Inventory", href: "/inventory", icon: Package },
    { label: "Sales", href: "/sales", icon: Banknote },
   ],
  },
  {
   title: "Insights",
   items: [
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "Forecasting", href: "/forecasting", icon: TrendingUp },
    { label: "Reports", href: "/reports", icon: FileText },
   ],
  },
  {
   title: "Management",
   items: [
    { label: "Users", href: "/users", icon: Users },
    { label: "Employees", href: "/employees", icon: Briefcase },
   ],
  },
  {
   title: "System",
   items: [
    { label: "Audit Log", href: "/audit", icon: ScrollText, ownerOnly: true },
    { label: "Settings", href: "/settings", icon: Settings },
   ],
  },
 ];


interface SidebarProps {
  /**
   * "desktop" (default) is the collapsible rail. "drawer" is the
   * locked-open copy rendered inside the mobile overlay - it ignores
   * the collapsed preference and shows no toggle.
   */
  variant?: "desktop" | "drawer";
}

export function Sidebar({ variant = "desktop" }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { collapsed, toggle } = useSidebarCollapsed();
  const isCollapsed = variant === "desktop" && collapsed;
  // Remember the last confirmed Owner state so the Owner-only Audit Log
  // doesn't unmount mid-navigation while the auth profile reloads
  // (user is briefly null between route changes).
  const [wasOwner, setWasOwner] = useState(false);
  useEffect(() => {
    if (user) setWasOwner(user.role === "Owner");
  }, [user]);
  const isOwner = user ? user.role === "Owner" : wasOwner;

  return (
   <aside
    className="sidebar m-3 h-[calc(100vh-24px)] rounded-2xl bg-[#17171c] border-white/10"
    aria-label="Main navigation"
   >
    <div className="flex flex-col h-full relative">
     {/* Logo. While collapsed only the wordmark hides, so the logo
         stays visible; the toggle lives at the bottom (see below). */}
      <div className="sidebar-brand">
       <Link href="/dashboard" className="sidebar-brand-link" aria-label="Brialyns Art Sign Panel">
        <img
          src="/logo.jpg"
          alt=""
          width={32}
          height={32}
          className="w-8 h-8 rounded-full object-cover ring-2 ring-white/80 shrink-0"
        />
        <span className={`sidebar-label font-bold text-xs text-white leading-tight whitespace-nowrap ${poppins.className}`}>
          Brialyns Art Sign <span className="text-white/40 font-semibold">| Panel</span>
        </span>
       </Link>
      </div>

      {/* Navigation - grouped by section titles. Scrollbar hidden
          (reference look): content still scrolls via wheel/touch. */}
      <nav className="relative flex-1 py-2 overflow-y-auto no-scrollbar" aria-label="Main navigation">
        {navigation.map((section) => {
          const items = section.items.filter(
            (item) => !item.ownerOnly || isOwner,
          );
          if (items.length === 0) return null;
          return (
          <div key={section.title} className="sidebar-section mb-2 last:mb-0">
          <h2 className="sidebar-section-title">
            {section.title}
          </h2>
         <ul className="space-y-1 px-3" role="list">
          {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
           <li key={item.href}>
             <Link
              href={item.href}
               className={`sidebar-link group ${
               isActive
                ? "bg-white text-black shadow-sm"
                : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              title={isCollapsed ? item.label : undefined}
             >
             <Icon
              className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 ${
               isActive ? "" : "group-hover:scale-110"
              }`}
              aria-hidden
             />
             <span className="sidebar-label font-medium truncate">{item.label}</span>
            </Link>
           </li>
          );
         })}
         </ul>
        </div>
        );
       })}
      </nav>

      {/* Collapse toggle pinned to the bottom so the brand/logo stays
          visible when the rail narrows. */}
      {variant === "desktop" && (
       <div className="sidebar-footer">
        <button
         type="button"
         onClick={toggle}
         className="sidebar-collapse-toggle"
         aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
         title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
         {isCollapsed ? (
          <ChevronsRight className="w-[18px] h-[18px] shrink-0" aria-hidden />
         ) : (
          <ChevronsLeft className="w-[18px] h-[18px] shrink-0" aria-hidden />
         )}
         <span className="sidebar-label truncate">
          {isCollapsed ? "Expand" : "Collapse"}
         </span>
        </button>
       </div>
      )}
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
      onClick={onClose}
      aria-hidden="true"
     />
    <aside className="sidebar m-3 h-[calc(100vh-24px)] rounded-2xl bg-[#17171c] border-white/10 w-60 z-50 lg:hidden transform transition-transform duration-300 ease-in-out">
     {children}
     <button
      onClick={onClose}
      className="absolute top-4 right-4 z-50 btn-ghost p-2 lg:hidden"
      aria-label="Close navigation menu"
     >
      <X className="w-5 h-5" />
     </button>
    </aside>
   </>
  );
}
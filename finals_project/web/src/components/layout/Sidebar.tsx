"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Poppins } from "next/font/google";
import {
  Factory,
  Menu,
  X,
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


export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isOwner = user?.role === "Owner";

  return (
   <aside
    className="sidebar m-3 h-[calc(100vh-24px)] rounded-2xl bg-[#17171c] border-white/10"
    aria-label="Main navigation"
   >
    <div className="flex flex-col h-full relative">
     {/* Logo */}
     <div className="relative flex items-center h-16 px-5">
      <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0" aria-label="Brialyns Art Sign Panel">
       <img
        src="/logo.jpg"
        alt=""
        width={32}
        height={32}
        className="w-8 h-8 rounded-full object-cover ring-2 ring-white/80 shrink-0"
       />
       <span className={`font-bold text-[13px] text-white leading-tight ${poppins.className}`}>
        Brialyns Art Sign <span className="text-white/40 font-semibold">| Panel</span>
       </span>
      </Link>
     </div>

     {/* Navigation - grouped by section titles */}
     <nav className="relative flex-1 py-2 overflow-y-auto no-scrollbar" aria-label="Main navigation">
       {navigation.map((section) => {
        const items = section.items.filter(
         (item) => !item.ownerOnly || isOwner,
        );
        if (items.length === 0) return null;
        return (
        <div key={section.title} className="mb-3 last:mb-0">
         <h2 className="px-6 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
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
              className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-[13px] ${
               isActive
                ? "bg-white text-black shadow-sm"
                : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
             aria-current={isActive ? "page" : undefined}
            >
             <Icon
              className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 ${
               isActive ? "" : "group-hover:scale-110"
              }`}
              aria-hidden
             />
             <span className="font-medium truncate">{item.label}</span>
            </Link>
           </li>
          );
         })}
         </ul>
        </div>
        );
       })}
      </nav>
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
    <aside className="sidebar m-3 h-[calc(100vh-24px)] rounded-2xl bg-[#17171c] border-white/10 w-64 z-50 lg:hidden transform transition-transform duration-300 ease-in-out">
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
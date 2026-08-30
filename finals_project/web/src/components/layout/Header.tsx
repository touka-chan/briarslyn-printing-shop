"use client";

import { useState, ReactNode } from "react";
import { Bell, Search, User, LogOut, Moon, Sun, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui";

interface HeaderProps {
 title: string;
 subtitle?: string;
 actions?: ReactNode;
 onSearch?: (value: string) => void;
 searchPlaceholder?: string;
}

export function Header({ title, subtitle, actions, onSearch, searchPlaceholder = "Search orders, inventory..." }: HeaderProps) {
 const [notificationsOpen, setNotificationsOpen] = useState(false);
 const [userMenuOpen, setUserMenuOpen] = useState(false);
 const [searchValue, setSearchValue] = useState("");

 const handleSearchChange = (value: string) => {
  setSearchValue(value);
  onSearch?.(value);
 };

 return (
  <header className="sticky top-0 z-30 bg-printflow-surface/80 backdrop-blur-sm border-b border-printflow-outline-variant">
   <div className="flex items-center justify-between h-16 px-6 gap-4">
    {/* Left: Title */}
    <div className="flex-1 min-w-0">
     <h1 className="text-xl font-headline font-semibold text-printflow-on-surface truncate">{title}</h1>
     {subtitle && <p className="text-sm text-printflow-on-surface-variant truncate">{subtitle}</p>}
    </div>

    {/* Center: Search (hidden on mobile) */}
    <div className="hidden md:flex flex-1 max-w-xl mx-8">
     <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-printflow-on-surface-variant w-5 h-5" />
      <input
       type="text"
       placeholder={searchPlaceholder}
       value={searchValue}
       onChange={(e) => handleSearchChange(e.target.value)}
       className="w-full px-4 py-2 pl-10 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent transition-all"
       aria-label="Global search"
      />
     </div>
    </div>

    {/* Right: Actions */}
    <div className="flex items-center gap-3">
     {actions}

     {/* Notifications */}
     <div className="relative">
      <button
       onClick={() => setNotificationsOpen(!notificationsOpen)}
       className="btn-ghost p-2 relative"
       aria-label="Notifications"
       aria-expanded={notificationsOpen}
      >
       <Bell className="w-5 h-5" />
       <span className="absolute top-1 right-1 w-2 h-2 bg-printflow-error rounded-full" />
      </button>

      {notificationsOpen && (
       <div className="absolute right-0 mt-2 w-72 bg-printflow-surface rounded-xl shadow-lg border border-printflow-outline-variant py-2 z-50">
        <div className="px-4 py-3 border-b border-printflow-outline-variant flex items-center justify-between">
         <h3 className="font-semibold text-printflow-on-surface">Notifications</h3>
         <Button variant="ghost" size="sm">Mark all read</Button>
        </div>
        <div className="max-h-64 overflow-y-auto">
         <div className="px-4 py-3">
          <p className="text-sm font-medium text-printflow-on-surface mb-1">Order #PF-2024-001</p>
          <p className="text-xs text-printflow-on-surface-variant">Production completed</p>
          <p className="text-xs text-printflow-on-surface-variant mt-1">2 minutes ago</p>
         </div>
         <div className="px-4 py-3 border-t border-printflow-outline-variant">
          <p className="text-sm font-medium text-printflow-on-surface mb-1">Low Stock Alert</p>
          <p className="text-xs text-printflow-on-surface-variant">Cardboard A4 - 15 units remaining</p>
          <p className="text-xs text-printflow-on-surface-variant mt-1">15 minutes ago</p>
         </div>
         <div className="px-4 py-3 border-t border-printflow-outline-variant">
          <p className="text-sm font-medium text-printflow-on-surface mb-1">New Order Received</p>
          <p className="text-xs text-printflow-on-surface-variant">Order #PF-2024-002 from Acme Corp</p>
          <p className="text-xs text-printflow-on-surface-variant mt-1">1 hour ago</p>
         </div>
        </div>
        <div className="p-3 border-t border-printflow-outline-variant">
         <Button variant="secondary" className="w-full" size="sm">View all notifications</Button>
        </div>
       </div>
      )}
     </div>

     {/* Theme Toggle */}
     <button className="btn-ghost p-2" aria-label="Toggle theme">
      <Sun className="w-5 h-5" />
     </button>

     {/* User Menu */}
     <div className="relative">
      <button
       onClick={() => setUserMenuOpen(!userMenuOpen)}
       className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-printflow-surface-container transition-colors"
       aria-label="User menu"
       aria-expanded={userMenuOpen}
      >
       <div className="w-8 h-8 bg-printflow-primary-fixed rounded-full flex items-center justify-center">
        <User className="w-5 h-5 text-printflow-primary" />
       </div>
       <ChevronDown className="w-4 h-4 text-printflow-on-surface-variant" />
      </button>

      {userMenuOpen && (
       <div className="absolute right-0 mt-2 w-48 bg-printflow-surface rounded-xl shadow-lg border border-printflow-outline-variant py-2 z-50">
        <div className="px-4 py-3 border-b border-printflow-outline-variant">
         <p className="font-medium text-printflow-on-surface">John Doe</p>
         <p className="text-xs text-printflow-on-surface-variant">admin@printfow.com</p>
         <p className="text-xs text-printflow-success mt-1">Admin</p>
        </div>
        <button className="dropdown-item w-full">
         <User className="w-4 h-4" />
         Profile
        </button>
        <button className="dropdown-item w-full">
         <Settings className="w-4 h-4" />
         Settings
        </button>
        <hr className="my-2 border-printflow-outline-variant" />
        <button className="dropdown-item w-full text-printflow-error flex items-center gap-3">
         <LogOut className="w-4 h-4" />
         Sign out
        </button>
       </div>
      )}
     </div>
    </div>
   </div>
  </header>
 );
}

import { Settings } from "lucide-react";
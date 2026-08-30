"use client";

import { FilterTab } from "@/types";
import { Search } from "lucide-react";

interface FilterToolbarProps {
 tabs: FilterTab[];
 activeTab: string;
 onTabChange: (tabId: string) => void;
 searchPlaceholder?: string;
 onSearchChange?: (value: string) => void;
 searchValue?: string;
 customActions?: React.ReactNode;
}

export function FilterToolbar({
 tabs,
 activeTab,
 onTabChange,
 searchPlaceholder = "Search...",
 onSearchChange,
 searchValue = "",
 customActions,
}: FilterToolbarProps) {
 return (
  <div className="filter-toolbar">
   <div className="flex flex-wrap items-center gap-2">
    {tabs.map((tab) => (
     <button
      key={tab.id}
      onClick={() => onTabChange(tab.id)}
      className={`filter-tab ${
       activeTab === tab.id ? "filter-tab-active" : "filter-tab-inactive"
      }`}
     >
      {tab.label}
      {tab.count !== undefined && (
       <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
        activeTab === tab.id
         ? "bg-printflow-on-primary/20 text-printflow-on-primary"
         : "bg-printflow-surface-container-high text-printflow-on-surface-variant"
       }`}>
        {tab.count}
       </span>
      )}
     </button>
    ))}
   </div>
   <div className="flex-1 min-w-[200px] flex items-center justify-end gap-3">
    {onSearchChange && (
     <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-printflow-on-surface-variant w-4 h-4" />
      <input
       type="text"
       placeholder={searchPlaceholder}
       value={searchValue}
       onChange={(e) => onSearchChange(e.target.value)}
       className="search-input pl-10"
      />
     </div>
    )}
    {customActions}
   </div>
  </div>
 );
}
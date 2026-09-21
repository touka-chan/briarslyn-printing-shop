"use client";

import { useState, ReactNode } from "react";
import { Sidebar, MobileSidebarTrigger, MobileSidebarOverlay } from "./Sidebar";
import { Header } from "./Header";

interface AdminLayoutProps {
 children: ReactNode;
 title: string;
 subtitle?: string;
 headerActions?: ReactNode;
 onSearch?: (value: string) => void;
}

export function AdminLayout({ children, title, subtitle, headerActions, onSearch }: AdminLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Canvas stays light in both modes; dark mode floats dark panels on it.
  return (
   <div className="min-h-screen bg-[#e2e5e9] flex">
    {/* Mobile Sidebar Overlay */}
    <MobileSidebarOverlay isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)}>
     <Sidebar />
    </MobileSidebarOverlay>

    {/* Desktop Sidebar */}
    <Sidebar />

    {/* Main Content - floating rounded panel like the reference */}
    <main className="main-content lg:relative px-3 pt-3">
     <div className="float-panel no-scrollbar rounded-2xl bg-printflow-surface border border-printflow-outline-variant/60 h-[calc(100vh-24px)] overflow-y-auto">
      {/* Mobile Header Trigger */}
      <MobileSidebarTrigger onClick={() => setMobileSidebarOpen(true)} />

      {/* Header */}
      <Header
       title={title}
       subtitle={subtitle}
       actions={headerActions}
       onSearch={onSearch}
      />

       {/* Page Content */}
       <div className="p-4">
        {children}
       </div>
     </div>
    </main>
  </div>
 );
}

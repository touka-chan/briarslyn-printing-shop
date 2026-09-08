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

 return (
  <div className="min-h-screen bg-printflow-bg flex">
   {/* Mobile Sidebar Overlay */}
   <MobileSidebarOverlay isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)}>
    <Sidebar />
   </MobileSidebarOverlay>

   {/* Desktop Sidebar */}
   <Sidebar />

   {/* Main Content */}
   <main className="main-content lg:relative">
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
    <div className="p-6">
     {children}
    </div>
   </main>
  </div>
 );
}

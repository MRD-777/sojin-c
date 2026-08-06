"use client";

import { ReactNode } from "react";
import { PrimarySidebar } from "./primary-sidebar";
import { SecondarySidebar } from "./secondary-sidebar";
import { TopHeader } from "./top-header";
import { CommandPalette } from "@/components/ui/command-palette";

export function DashboardLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-[#fcfcfc] dark:bg-[#050505] overflow-hidden text-[#111] dark:text-[#e0e0e0] font-sans">
      {/* Primary Sidebar - Desktop only, mobile uses bottom nav */}
      <PrimarySidebar />
      
      {/* Secondary Sidebar - Desktop: collapsible panel, Mobile: overlay drawer */}
      <SecondarySidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader />
        
        {/* Scrollable Main Viewport — pb-16 on mobile for bottom nav clearance */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-black pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Global Command Palette (⌘K) */}
      <CommandPalette />
    </div>
  );
}

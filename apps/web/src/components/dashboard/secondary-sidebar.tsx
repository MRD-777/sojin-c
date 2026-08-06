"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/use-sidebar-store";
import { secondaryNavigation, primaryNavigation, bottomNavigation } from "@/config/navigation";
import React from "react";

export function SecondarySidebar() {
  const t = useTranslations("Common");
  const pathname = usePathname();
  const { isSecondarySidebarOpen, toggleSecondarySidebar, setSecondarySidebarOpen } = useSidebarStore();

  const activePrimaryId = React.useMemo(() => {
    const allItems = [...primaryNavigation, ...bottomNavigation];
    const match = allItems.sort((a, b) => b.href.length - a.href.length).find(item => {
      if (item.id === 'dashboard') {
        return pathname.endsWith('/dashboard') || pathname.endsWith('/dashboard/');
      }
      return pathname.includes(item.href);
    });
    return match?.id || 'dashboard';
  }, [pathname]);

  const allNavItems = [...primaryNavigation, ...bottomNavigation];
  const activePrimaryData = allNavItems.find(item => item.id === activePrimaryId);
  const secondaryItems = secondaryNavigation[activePrimaryId] || [];

  const activeSecondaryItem = React.useMemo(() => {
    if (!secondaryItems || secondaryItems.length === 0) return null;
    
    const sorted = [...secondaryItems].sort((a, b) => b.href.length - a.href.length);
    const match = sorted.find(item => {
      if (item.href === '/dashboard') {
        return pathname.endsWith('/dashboard') || pathname.endsWith('/dashboard/');
      }
      return pathname.endsWith(item.href) || pathname.includes(item.href + '/');
    });
    return match?.id;
  }, [pathname, secondaryItems]);

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isSecondarySidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setSecondarySidebarOpen(false)}
        />
      )}

      <div className={cn(
        "h-screen shrink-0 z-50 flex",
        // On mobile: fixed overlay, Desktop: relative
        "fixed inset-y-0 start-0 md:inset-auto md:relative",
      )}>
        <aside
          className={cn(
            "h-full bg-neutral-50 dark:bg-[#111111] border-e border-black/5 dark:border-white/10 transition-all duration-300 ease-in-out flex flex-col",
            isSecondarySidebarOpen ? "w-64" : "w-0",
            // On mobile: always on top
            "md:z-10 z-50"
          )}
        >
          <div className={cn("flex flex-col h-full w-64 transition-opacity duration-300", isSecondarySidebarOpen ? "opacity-100" : "opacity-0 overflow-hidden")}>
            <div className="flex-1 overflow-y-auto">
              {/* Root Node (Primary Category) */}
              <div className="flex items-center justify-between h-14 px-3 border-b border-gray-200 dark:border-white/10">
                <h2 className="text-sm font-bold tracking-wide text-[#111] dark:text-white">
                  {activePrimaryData ? t(activePrimaryData.titleKey) : ""}
                </h2>
                {/* Mobile close button */}
                <button 
                  onClick={() => setSecondarySidebarOpen(false)}
                  className="md:hidden p-1.5 rounded-lg text-[#666] hover:text-[#111] dark:text-[#999] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Secondary Navigation List */}
              {secondaryItems.length > 0 ? (
                <div className="flex flex-col space-y-3 px-5 py-3">
                  {secondaryItems.map((item) => {
                    const active = item.id === activeSecondaryItem;
                    const isDeeper = active && pathname.includes(item.href + '/');
                    const subpageName = isDeeper ? pathname.split('/').pop() : "";
                    
                    return (
                      <div key={item.id} className="flex flex-col">
                        <Link
                          href={item.href}
                          onClick={() => {
                            if (window.innerWidth < 768) {
                              setSecondarySidebarOpen(false);
                            }
                          }}
                          className={cn(
                            "flex items-center px-3 py-2 text-sm transition-all duration-200 rounded-md",
                            active && !isDeeper
                              ? "text-[#111] dark:text-white font-medium bg-black/5 dark:bg-white/10" 
                              : active && isDeeper
                              ? "text-[#111] dark:text-white font-medium"
                              : "text-[#666] dark:text-[#999] hover:text-[#111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                          )}
                        >
                          {t(item.titleKey)}
                        </Link>
                        
                        {/* Custom 3rd Level Tree for All Projects */}
                        {active && item.id === 'all_projects' && (
                          <div className="relative ps-4 ms-4 border-s border-black/10 dark:border-white/10 flex flex-col mt-1 mb-2 space-y-1">
                            {[
                              { id: "PRJ-2025-001", name: t("navMock.prj1") },
                              { id: "PRJ-2025-002", name: t("navMock.prj2") }
                            ].map((project) => {
                              const isProjectActive = pathname.includes(project.id);
                              return (
                                <Link
                                  key={project.id}
                                  href={`/dashboard/projects/${project.id}`}
                                  className="relative group flex items-center"
                                  onClick={() => {
                                    if (window.innerWidth < 768) setSecondarySidebarOpen(false);
                                  }}
                                >
                                  <div className={cn(
                                    "absolute h-px w-3 -start-4 top-1/2 -translate-y-1/2 transition-colors",
                                    isProjectActive ? "bg-blue-600 dark:bg-blue-500" : "bg-black/10 dark:bg-white/10 group-hover:bg-black/30 dark:group-hover:bg-white/30"
                                  )} />
                                  {isProjectActive && (
                                    <div className="absolute w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-500 top-1/2 -start-[19px] -translate-y-1/2 shadow-[0_0_0_4px_#fbfbfb] dark:shadow-[0_0_0_4px_#111111]" />
                                  )}
                                  <div className={cn(
                                    "px-3 py-1.5 text-xs transition-colors rounded-md w-full truncate",
                                    isProjectActive 
                                      ? "font-medium text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10" 
                                      : "text-[#666] dark:text-[#999] hover:text-[#111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                                  )}>
                                    {project.name}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        )}

                        {/* General 3rd Level Tree Node for other sections if needed */}
                        {isDeeper && item.id !== 'all_projects' && (
                          <div className="relative ps-4 ms-4 border-s border-black/10 dark:border-white/10 flex flex-col mt-1 mb-1">
                            <div className="relative group flex items-center">
                              <div className="absolute h-px w-3 -start-4 top-1/2 -translate-y-1/2 bg-blue-600 dark:bg-blue-500" />
                              <div className="absolute w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-500 top-1/2 -start-[19px] -translate-y-1/2 shadow-[0_0_0_4px_#fbfbfb] dark:shadow-[0_0_0_4px_#111111]" />
                              <div className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10 rounded-md w-full truncate">
                                {subpageName ? decodeURIComponent(subpageName) : t("nav.details")}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-[#999] text-center mt-6">
                  {t("nav.noSubmenu")}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Collapse Toggle Button — Desktop only */}
        <button
          onClick={toggleSecondarySidebar}
          className={cn(
            "absolute top-6 w-7 h-7 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 rounded-full flex items-center justify-center text-[#111] dark:text-white shadow-md z-50 hidden md:flex transition-all duration-300 hover:scale-110",
            "-end-3.5"
          )}
        >
          {isSecondarySidebarOpen ? (
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          ) : (
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          )}
        </button>
      </div>
    </>
  );
}

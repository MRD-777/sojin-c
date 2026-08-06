"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/use-sidebar-store";
import { primaryNavigation, bottomNavigation } from "@/config/navigation";
import React from "react";

export function PrimarySidebar() {
  const t = useTranslations("Common");
  const pathname = usePathname();
  const { setActivePrimaryItem } = useSidebarStore();

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

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-16 h-screen flex-col bg-[#111] dark:bg-black border-r border-white/5 text-[#999] transition-colors z-50 shrink-0">
        <div className="h-14 flex items-center justify-center border-b border-white/5">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-[#111] shadow-sm">
            S
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-2 items-center">
          {primaryNavigation.map((item) => {
            const Icon = item.icon;
            const active = activePrimaryId === item.id;
            
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setActivePrimaryItem(item.id)}
                className={cn(
                  "relative group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                  active 
                    ? "bg-white text-[#111] shadow-sm" 
                    : "hover:bg-white/10 hover:text-white"
                )}
                title={t(item.titleKey)}
              >
                {Icon && <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />}
              </Link>
            );
          })}
        </div>

        <div className="py-4 flex flex-col gap-2 items-center border-t border-white/5">
          {bottomNavigation.map((item) => {
            const Icon = item.icon;
            const active = activePrimaryId === item.id;
            
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setActivePrimaryItem(item.id)}
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                  active 
                    ? "bg-white text-[#111] shadow-sm" 
                    : "hover:bg-white/10 hover:text-white"
                )}
                title={t(item.titleKey)}
              >
                {Icon && <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#111] border-t border-black/5 dark:border-white/5 safe-area-pb">
        <div className="flex items-center justify-around px-2 py-1.5">
          {primaryNavigation.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = activePrimaryId === item.id;
            
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setActivePrimaryItem(item.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0",
                  active 
                    ? "text-[#111] dark:text-white" 
                    : "text-[#999] dark:text-[#666]"
                )}
              >
                {Icon && <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.5} />}
                <span className="text-[9px] font-bold truncate max-w-[56px]">
                  {t(item.titleKey)}
                </span>
                {active && (
                  <div className="absolute bottom-0 w-6 h-0.5 bg-[#111] dark:bg-white rounded-t-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

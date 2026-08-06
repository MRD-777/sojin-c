"use client";

import { useTranslations } from "next-intl";
import { Search, Bell, Sun, Moon, Globe, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { usePathname, useRouter } from "@/i18n/routing";
import { useSidebarStore } from "@/store/use-sidebar-store";

export function TopHeader() {
  const t = useTranslations("Common");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSecondarySidebar } = useSidebarStore();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleLanguage = () => {
    const isRtl = document.dir === 'rtl';
    const nextLocale = isRtl ? 'en' : 'ar';
    router.replace(pathname, { locale: nextLocale });
  };

  // Open command palette via keyboard shortcut hint click
  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  return (
    <header className="h-14 bg-white dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 flex items-center justify-between px-3 sm:px-4 shrink-0 z-40">
      
      {/* Left section: Mobile menu toggle + Search */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1">
        <button 
          onClick={toggleSecondarySidebar}
          className="md:hidden p-2 text-[#666] hover:text-[#111] dark:text-[#999] dark:hover:text-white rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Desktop Search */}
        <div className="relative max-w-md w-full hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
          <button 
            onClick={openCommandPalette}
            className="w-full pl-9 pr-12 py-1.5 bg-[#fcfcfc] dark:bg-[#111] border border-black/5 dark:border-white/5 rounded-lg text-sm text-[#999] text-start transition-shadow hover:border-black/10 dark:hover:border-white/10 cursor-pointer"
          >
            {t("searchPlaceholder")}
          </button>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/10 text-[#666] dark:text-[#999]">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>

        {/* Mobile Search Button */}
        <button 
          onClick={openCommandPalette}
          className="md:hidden p-2 text-[#666] hover:text-[#111] dark:text-[#999] dark:hover:text-white rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Right section: Actions + Profile */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Language Toggle */}
        <button 
          onClick={toggleLanguage}
          className="p-2 text-[#666] hover:text-[#111] dark:text-[#999] dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title={t("toggleLanguage")}
        >
          <Globe className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 text-[#666] hover:text-[#111] dark:text-[#999] dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title={t("toggleTheme")}
        >
          {mounted && (
            <>
              <Sun className="w-4 h-4 hidden dark:block transition-all" />
              <Moon className="w-4 h-4 block dark:hidden transition-all" />
            </>
          )}
          {!mounted && <div className="w-4 h-4" />}
          <span className="sr-only">Toggle theme</span>
        </button>

        {/* Notifications */}
        <button 
          className="relative p-2 text-[#666] hover:text-[#111] dark:text-[#999] dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title={t("notifications")}
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-[#0a0a0a]"></span>
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-black/5 dark:bg-white/5 hidden sm:block"></div>

        {/* User Profile */}
        <button className="flex items-center gap-2 pl-1 sm:pl-2">
          <div className="w-8 h-8 bg-black/5 dark:bg-white/10 text-[#111] dark:text-white rounded-full flex items-center justify-center font-semibold text-sm">
            M
          </div>
          <div className="hidden sm:flex flex-col items-start text-left">
            <span className="text-sm font-medium text-[#111] dark:text-white leading-tight">Mohamed</span>
            <span className="text-xs text-[#666] dark:text-[#999] leading-tight">Super Admin</span>
          </div>
        </button>
      </div>

    </header>
  );
}

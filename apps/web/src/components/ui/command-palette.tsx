"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Search,
  LayoutDashboard,
  Building2,
  Wallet,
  Users,
  HardHat,
  MessageSquare,
  Settings,
  BarChart3,
  History,
  ArrowRight,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  group: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const t = useTranslations("Common");

  const commands: CommandItem[] = [
    { id: "dashboard", label: t("nav.dashboard"), icon: <LayoutDashboard className="w-4 h-4" />, href: "/dashboard", group: t("nav.dashboard") },
    { id: "projects", label: t("nav.projects"), icon: <Building2 className="w-4 h-4" />, href: "/dashboard/projects", group: t("nav.dashboard") },
    { id: "finance", label: t("nav.finance"), icon: <Wallet className="w-4 h-4" />, href: "/dashboard/finance", group: t("nav.dashboard") },
    { id: "team", label: t("nav.team"), icon: <Users className="w-4 h-4" />, href: "/dashboard/team", group: t("nav.dashboard") },
    { id: "subcontractors", label: t("nav.subcontractors"), icon: <HardHat className="w-4 h-4" />, href: "/dashboard/subcontractors", group: t("nav.dashboard") },
    { id: "chat", label: t("nav.chat"), icon: <MessageSquare className="w-4 h-4" />, href: "/dashboard/chat", group: t("nav.dashboard") },
    { id: "reports", label: t("dashboardPage.reports.title"), icon: <BarChart3 className="w-4 h-4" />, href: "/dashboard/reports", group: t("nav.reports") },
    { id: "audit", label: t("dashboardPage.audit.title"), icon: <History className="w-4 h-4" />, href: "/dashboard/audit", group: t("nav.reports") },
    { id: "settings", label: t("nav.settings"), icon: <Settings className="w-4 h-4" />, href: "/dashboard/settings", group: t("nav.settings") },
    { id: "new-project", label: t("dashboardPage.projects.newProject"), icon: <Building2 className="w-4 h-4" />, href: "/dashboard/projects/new", group: t("nav.projects") },
  ];

  const filtered = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (item: CommandItem) => {
    router.push(item.href);
    setIsOpen(false);
  };

  const handleKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#111] rounded-2xl shadow-2xl shadow-black/20 border border-black/10 dark:border-white/10 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 border-b border-black/5 dark:border-white/5">
          <Search className="w-5 h-5 text-[#999] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyNav}
            placeholder="ابحث عن صفحة أو إجراء..."
            className="flex-1 py-4 bg-transparent text-[#111] dark:text-white text-sm placeholder:text-[#999] outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-black/5 dark:bg-white/10 text-[#666] dark:text-[#999]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#999]">
              لا توجد نتائج لـ &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  selectedIndex === index
                    ? "bg-[#111] text-white dark:bg-white dark:text-[#111]"
                    : "text-[#666] dark:text-[#999] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <span className={selectedIndex === index ? "opacity-100" : "opacity-60"}>
                  {item.icon}
                </span>
                <span className="flex-1 text-start font-medium">{item.label}</span>
                <ArrowRight className={`w-3.5 h-3.5 rtl:rotate-180 ${selectedIndex === index ? "opacity-60" : "opacity-0"}`} />
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-[#999]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">↑↓</kbd> تنقل</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">↵</kbd> فتح</span>
          </div>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">ESC</kbd> إغلاق</span>
        </div>
      </div>
    </div>
  );
}

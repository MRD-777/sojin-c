"use client";
import { Link } from "@/i18n/routing";
import { MoveRight } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useTranslations } from "next-intl";

export function Header() {
  const t = useTranslations("Landing.Header");

  const navLinks = [
    [t("home"), "/"],
    [t("pricing"), "/pricing"],
    [t("solutions"), "/solutions"],
    [t("about"), "/about"],
    [t("contact"), "/contact"]
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#F8F9FA]/80 dark:bg-[#0f0f12]/80 backdrop-blur-2xl border-b border-neutral-200/60 dark:border-white/10 transition-colors duration-300">
      <div className="max-w-[1300px] mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center">
            <div className="flex gap-[2.5px]"><div className="w-[2.5px] h-3 bg-white rounded-full"/><div className="w-[2.5px] h-4 bg-white/90 rounded-full"/><div className="w-[2.5px] h-2.5 bg-white/80 rounded-full"/></div>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-[#1a1a1a] dark:text-white">سوجين</span>
        </Link>
        <nav className="hidden md:flex gap-8 text-[14px] text-neutral-500 dark:text-neutral-400 font-semibold">
          {navLinks.map(([l, h]) => (
            <Link key={h} href={h} className="hover:text-black dark:hover:text-white transition-colors duration-300">{l}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 md:gap-4">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link href="/login" className="hidden sm:block text-[14px] text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white font-semibold transition-colors">{t("login")}</Link>
          <Link href="/register" className="flex items-center gap-2 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] hover:bg-neutral-800 dark:hover:bg-neutral-200 text-[14px] font-bold px-6 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95 shadow-md">
            {t("startFree")} <MoveRight className="w-4 h-4 rtl:rotate-180"/>
          </Link>
        </div>
      </div>
    </header>
  );
}

"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";

export function Footer() {
  const pathname = usePathname();
  const t = useTranslations("Landing.Footer");

  return (
    <footer className="border-t border-neutral-200 dark:border-white/10 pt-20 pb-10 px-6 bg-white dark:bg-[#0f0f12] transition-colors duration-300">
      <div className="max-w-[1300px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center">
                <div className="flex gap-[2.5px]"><div className="w-[2.5px] h-3 bg-white rounded-full"/><div className="w-[2.5px] h-4 bg-white/90 rounded-full"/><div className="w-[2.5px] h-2.5 bg-white/80 rounded-full"/></div>
              </div>
              <span className="text-2xl font-black text-[#1a1a1a] dark:text-white tracking-tight transition-colors duration-300">سوجين</span>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-[16px] max-w-sm leading-relaxed font-medium transition-colors duration-300">{t("desc")}</p>
          </div>
          <div>
            <h4 className="font-bold text-[#1a1a1a] dark:text-white text-[13px] uppercase tracking-widest mb-6 transition-colors duration-300">{t("platform")}</h4>
            <ul className="space-y-4 text-neutral-500 dark:text-neutral-400 text-[15px] font-medium transition-colors duration-300">
              <li><Link href="/solutions" className="hover:text-sky-500 transition-colors">{t("solutions")}</Link></li>
              <li><Link href="/pricing" className="hover:text-sky-500 transition-colors">{t("pricing")}</Link></li>
              <li><Link href="#" className="hover:text-sky-500 transition-colors">{t("updates")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-[#1a1a1a] dark:text-white text-[13px] uppercase tracking-widest mb-6 transition-colors duration-300">{t("company")}</h4>
            <ul className="space-y-4 text-neutral-500 dark:text-neutral-400 text-[15px] font-medium transition-colors duration-300">
              <li><Link href="/about" className="hover:text-sky-500 transition-colors">{t("about")}</Link></li>
              <li><Link href="/contact" className="hover:text-sky-500 transition-colors">{t("contact")}</Link></li>
              <li><Link href="#" className="hover:text-sky-500 transition-colors">{t("terms")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-neutral-100 dark:border-white/10 gap-4 transition-colors duration-300">
          <p className="text-[14px] text-neutral-400 dark:text-neutral-500 font-medium transition-colors duration-300">{t("copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex gap-6 text-neutral-400 dark:text-neutral-500 text-[14px] font-medium transition-colors duration-300">
            <Link href={pathname} locale="ar" className="hover:text-sky-500 transition-colors">العربية</Link>
            <Link href={pathname} locale="en" className="hover:text-sky-500 transition-colors">English</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

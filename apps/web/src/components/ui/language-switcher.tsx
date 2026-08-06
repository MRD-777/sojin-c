"use client";

import * as React from "react";
import { Languages } from "lucide-react";
import { usePathname, Link } from "@/i18n/routing";
import { useLocale } from "next-intl";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const nextLocale = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={nextLocale}
      className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors bg-transparent hover:bg-neutral-100 dark:hover:bg-white/10"
      aria-label="Toggle language"
    >
      <Languages className="h-5 w-5" />
      <span className="sr-only">Toggle language</span>
    </Link>
  );
}

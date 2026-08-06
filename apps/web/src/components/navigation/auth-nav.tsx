"use client";

import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { Moon, Sun, Languages } from "lucide-react";
import { useEffect, useState } from "react";

export function AuthNav() {
  const { resolvedTheme, setTheme } = useTheme();
  const locale = useLocale();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div className="absolute top-6 end-6 z-50 flex items-center gap-4">
      {/* Language Switcher */}
      <Link
        href={pathname}
        locale={locale === "ar" ? "en" : "ar"}
        className="group relative flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 backdrop-blur-xl rounded-full text-white/70 hover:text-white hover:border-white/20 transition-all duration-300 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        <Languages className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {locale === 'ar' ? 'English' : 'عربي'}
        </span>
      </Link>
      
      {mounted && (
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10 bg-white/5 backdrop-blur-md text-[#e0e0e0] hover:bg-white/10 transition-all cursor-pointer group"
          title="Toggle Theme"
        >
          <div className="relative overflow-hidden w-full h-full flex items-center justify-center rounded-full">
             <Sun className="h-4 w-4 hidden dark:block transition-transform duration-500 group-hover:rotate-45" />
             <Moon className="h-4 w-4 block dark:hidden transition-transform duration-500 group-hover:-rotate-12" />
          </div>
        </button>
      )}
    </div>
  );
}

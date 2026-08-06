"use client";

import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { Moon, Sun, Languages, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function LandingHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const locale = useLocale();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("Landing.Header");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-center p-6 pointer-events-none">
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-7xl h-16 bg-background/40 backdrop-blur-[40px] border-b border-border flex items-center justify-between px-8 pointer-events-auto"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-primary rounded-none flex items-center justify-center transition-transform group-hover:rotate-90 duration-500">
            <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tighter text-foreground uppercase italic">
            Saas<span className="text-primary tracking-normal not-italic lowercase">One</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">
            {locale === 'ar' ? 'المميزات' : 'Features'}
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">
            {locale === 'ar' ? 'الأسعار' : 'Pricing'}
          </Link>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Language Switcher */}
          <Link
            href={pathname}
            locale={locale === "ar" ? "en" : "ar"}
            className="flex items-center gap-2 px-3 py-2 hover:bg-accent/10 transition-colors border-x border-border"
          >
            <Languages className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] font-bold text-foreground uppercase tracking-widest">
              {locale === 'ar' ? 'EN' : 'AR'}
            </span>
          </Link>

          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="w-8 h-8 flex items-center justify-center hover:bg-accent/10 transition-colors"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Moon className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          )}

          {/* Auth Buttons */}
          <div className="flex items-center gap-2 ms-4">
            <Link 
              href="/login" 
              className="px-4 py-2 text-xs font-bold text-foreground hover:text-primary transition-colors uppercase tracking-widest"
            >
              {t("login")}
            </Link>
            <Link 
              href="/register" 
              className="px-6 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all"
            >
              {t("startFree")}
            </Link>
          </div>
        </div>
      </motion.nav>
    </header>
  );
}

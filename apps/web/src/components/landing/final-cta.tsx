"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function FinalCTA() {
  const t = useTranslations("Landing.final_cta");
  const locale = useLocale();

  return (
    <section className="py-32 relative overflow-hidden flex items-center justify-center">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
      
      <div className="container mx-auto px-6 relative z-10 text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 border border-primary/20 bg-primary/5 rounded-none"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
            {locale === 'ar' ? 'ابدأ اليوم' : 'Get Started Today'}
          </span>
        </motion.div>

        <h2 className="text-4xl md:text-7xl font-bold text-white uppercase italic leading-none max-w-4xl mx-auto">
          {t("title")}
        </h2>
        
        <p className="text-white/40 font-light max-w-2xl mx-auto text-lg">
          {t("subtitle")}
        </p>

        <div className="pt-8">
          <Link
            href="/register"
            className="group relative px-12 py-5 bg-primary text-primary-foreground font-bold uppercase tracking-[0.2em] inline-block overflow-hidden"
          >
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform" />
            <span className="relative z-10">{t("button")}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

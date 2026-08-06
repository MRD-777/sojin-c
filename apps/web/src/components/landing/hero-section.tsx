"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { ChevronRight, ArrowLeft } from "lucide-react";

export function HeroSection() {
  const t = useTranslations("Landing.hero");
  const locale = useLocale();
  const isRtl = locale === 'ar';

  return (
    <section className="relative min-h-screen flex items-center pt-24 overflow-hidden">
      <div className="container mx-auto px-6 grid md:grid-cols-12 gap-12 items-center">
        {/* Text Content - Asymmetric Layout */}
        <div className="md:col-span-7 space-y-8 z-10">
          <motion.div
            initial={{ opacity: 0, x: isRtl ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9] text-foreground uppercase italic">
              {t("title").split(' ').map((word, i) => (
                <span key={i} className={i % 2 === 1 ? "text-primary not-italic" : "block"}>
                  {word}{" "}
                </span>
              ))}
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-lg md:text-xl text-muted-foreground max-w-xl font-light leading-relaxed"
          >
            {t("subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex flex-col sm:flex-row items-center gap-4 pt-4"
          >
            <Link
              href="/register"
              className="group relative px-8 py-4 bg-primary text-primary-foreground font-bold uppercase tracking-widest flex items-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative z-10">{t("cta_primary")}</span>
              {isRtl ? <ArrowLeft className="w-5 h-5 relative z-10" /> : <ChevronRight className="w-5 h-5 relative z-10" />}
            </Link>

            <Link
              href="/pricing"
              className="px-8 py-4 border border-border text-foreground/70 hover:text-foreground hover:bg-accent/10 transition-all font-bold uppercase tracking-widest"
            >
              {t("cta_secondary")}
            </Link>
          </motion.div>
        </div>

        {/* Visual Element - Geometric/Architectural */}
        <div className="md:col-span-5 relative hidden md:block">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative w-full aspect-square border border-border bg-card/5 backdrop-blur-3xl p-8 shadow-2xl"
          >
            {/* Architectural Wireframe Simulation */}
            <div className="absolute inset-0 p-8 flex flex-col justify-between">
              <div className="flex justify-between border-b border-border pb-4 text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
                <span>Ref: ARC-704F</span>
                <span>Scale: 1:100</span>
              </div>
              
              <div className="flex-1 flex flex-col justify-center gap-8 py-12">
                <div className="h-[2px] w-full bg-gradient-to-r from-primary/50 to-transparent" />
                <div className="h-[2px] w-[60%] bg-gradient-to-r from-primary/50 to-transparent" />
                <div className="h-[2px] w-[80%] bg-gradient-to-r from-primary/50 to-transparent" />
              </div>

              <div className="border-t border-border pt-4 flex items-center justify-between">
                <div className="w-12 h-12 border border-primary/20 flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary animate-pulse" />
                </div>
                <div className="text-right space-y-1">
                  <div className="text-[10px] text-primary font-bold uppercase">System Active</div>
                  <div className="text-[8px] text-muted-foreground/40 font-mono uppercase tracking-tighter">Coordinates: 30.0444° N, 31.2357° E</div>
                </div>
              </div>
            </div>

            {/* Glowing Focal Point */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary/20 rounded-full blur-3xl opacity-30" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

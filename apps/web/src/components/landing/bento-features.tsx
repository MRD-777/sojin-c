"use client";

import { useTranslations, useLocale } from "next-intl";
import { motion } from "framer-motion";
import { 
  Scan, CloudSync, Wallet, Layers, Target, Activity, 
  Truck, ShoppingCart, ShieldCheck, FileCheck, Users 
} from "lucide-react";

export function BentoFeatures() {
  const t = useTranslations("Landing.features");
  const locale = useLocale();
  const isRtl = locale === 'ar';

  const cards = [
    {
      key: "ai_intelligence",
      icon: <Scan className="w-8 h-8 text-primary" />,
      visual: (
        <div className="absolute inset-x-0 bottom-0 top-1/2 overflow-hidden px-6">
          <div className="w-full h-full border-t border-x border-border bg-accent/5 flex flex-col p-4 gap-2">
            <div className="h-2 w-full bg-muted" />
            <div className="h-2 w-[80%] bg-primary/20" />
            <div className="h-2 w-[90%] bg-muted" />
            <div className="flex-1 flex items-end gap-2">
               {[...Array(8)].map((_, i) => (
                 <motion.div 
                   key={i}
                   animate={{ height: `${20 + Math.random() * 80}%` }}
                   transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
                   className="w-full bg-primary/20 border-t border-primary/40"
                 />
               ))}
            </div>
          </div>
        </div>
      ),
      span: "md:col-span-8"
    },
    {
      key: "blueprint_sync",
      icon: <CloudSync className="w-8 h-8 text-primary" />,
      visual: (
        <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-20 transition-opacity">
           <Layers className="w-48 h-48 text-primary animate-pulse" />
        </div>
      ),
      span: "md:col-span-4"
    },
    {
      key: "fleet_control",
      icon: <Truck className="w-8 h-8 text-primary" />,
      visual: (
        <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden px-6">
          <div className="w-full h-full border-t border-x border-border bg-accent/5 relative">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, var(--blueprint-dots) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ 
                  x: ["0%", "200%", "0%"],
                  y: ["0%", "50%", "0%"],
                  opacity: [0.2, 1, 0.2]
                }}
                transition={{ duration: 10 + i * 2, repeat: Infinity, ease: "linear" }}
                className="absolute w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_var(--blueprint-accent)]"
                style={{ top: `${20 + i * 30}%`, left: `${10 + i * 20}%` }}
              />
            ))}
          </div>
        </div>
      ),
      span: "md:col-span-4"
    },
    {
      key: "smart_procurement",
      icon: <ShoppingCart className="w-8 h-8 text-primary" />,
      visual: (
        <div className="absolute inset-x-0 bottom-0 h-1/2 flex items-end justify-center p-6 gap-2">
           {[...Array(5)].map((_, i) => (
             <motion.div 
               key={i}
               initial={{ height: 0 }}
               whileInView={{ height: `${30 + i * 15}%` }}
               className="w-8 bg-primary/20 border-t-2 border-primary"
             />
           ))}
        </div>
      ),
      span: "md:col-span-4"
    },
    {
      key: "safety_iot",
      icon: <ShieldCheck className="w-8 h-8 text-primary" />,
      visual: (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
             <motion.div 
               animate={{ scale: [1, 2], opacity: [0.5, 0] }}
               transition={{ duration: 2, repeat: Infinity }}
               className="absolute inset-0 rounded-full border border-primary/50"
             />
             <Activity className="w-12 h-12 text-primary opacity-20" />
          </div>
        </div>
      ),
      span: "md:col-span-4"
    },
    {
      key: "financial_clarity",
      icon: <Wallet className="w-8 h-8 text-primary" />,
      visual: (
        <div className="absolute inset-x-0 bottom-0 p-8">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-mono mb-2">
            <span>ROI Forecast</span>
            <span>+24.8%</span>
          </div>
          <div className="h-1 w-full bg-accent/20 overflow-hidden">
            <motion.div 
              initial={{ x: "-100%" }}
              whileInView={{ x: "0%" }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full w-[70%] bg-primary shadow-[0_0_10px_var(--blueprint-accent)]"
            />
          </div>
        </div>
      ),
      span: "md:col-span-12"
    },
    {
      key: "compliance_engine",
      icon: <FileCheck className="w-8 h-8 text-primary" />,
      visual: (
        <div className="absolute inset-x-0 bottom-0 top-1/2 px-8">
           <div className="grid grid-cols-2 gap-2">
             {[...Array(4)].map((_, i) => (
               <div key={i} className="h-12 border border-border bg-accent/5 flex items-center px-4 gap-2">
                 <div className="w-3 h-3 rounded-full bg-primary/40" />
                 <div className="h-1 flex-1 bg-muted" />
               </div>
             ))}
           </div>
        </div>
      ),
      span: "md:col-span-6"
    },
    {
      key: "resource_dynamic",
      icon: <Users className="w-8 h-8 text-primary" />,
      visual: (
        <div className="absolute inset-0 opacity-10 flex items-center justify-center scale-150">
          <div className="grid grid-cols-6 gap-1">
             {[...Array(36)].map((_, i) => (
               <div key={i} className={`w-8 h-8 ${Math.random() > 0.7 ? 'bg-primary' : 'bg-muted'} rounded-sm`} />
             ))}
          </div>
        </div>
      ),
      span: "md:col-span-6"
    }
  ];

  return (
    <section id="features" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-3xl mb-16 space-y-4">
          <motion.div
            initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 text-primary text-[10px] font-bold uppercase tracking-widest"
          >
            <Activity className="w-4 h-4" />
            <span>{locale === 'ar' ? 'البنية التحتية الذكية' : 'Smart Infrastructure'}</span>
          </motion.div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground uppercase italic leading-none">
            {t("title")}
          </h2>
          <p className="text-muted-foreground font-light max-w-xl">
            {t("subtitle")}
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid md:grid-cols-12 gap-1 bg-border/20 border border-border p-1">
          {cards.map((card, i) => (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`${card.span} min-h-[350px] bg-background relative group overflow-hidden p-8 flex flex-col`}
            >
              {/* Card visual logic */}
              <div className="absolute inset-0 z-0">
                {card.visual}
              </div>
              
              <div className="relative z-10 space-y-4 mt-auto">
                <div className="p-3 bg-accent/5 w-fit border border-border group-hover:border-primary/40 transition-colors">
                  {card.icon}
                </div>
                <h3 className="text-xl font-bold text-foreground uppercase italic tracking-tighter">
                  {t(`${card.key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground font-light max-w-[280px]">
                  {t(`${card.key}.desc`)}
                </p>
              </div>

              {/* Hover Glow */}
              <div className="absolute inset-0 bg-primary/[0.03] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

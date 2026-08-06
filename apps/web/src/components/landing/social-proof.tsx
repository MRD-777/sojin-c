"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

export function SocialProof() {
  const t = useTranslations("Landing.social_proof");

  const firms = [
    "Foster + Partners",
    "Zaha Hadid",
    "Gensler",
    "SOM",
    "Perkins&Will",
    "HKS",
    "HDR",
    "AECOM"
  ];

  return (
    <section className="py-12 border-y border-white/5 bg-white/[0.01]">
      <div className="container mx-auto px-6">
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] text-center mb-8">
          {t("title")}
        </p>
        
        <div className="flex overflow-hidden group">
          <motion.div 
            animate={{ x: "-50%" }}
            transition={{ 
              duration: 30, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="flex items-center gap-16 whitespace-nowrap min-w-full"
          >
            {[...firms, ...firms].map((firm, i) => (
              <span 
                key={i} 
                className="text-2xl md:text-3xl font-bold text-white/10 hover:text-primary/40 transition-colors uppercase italic tracking-tighter"
              >
                {firm}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

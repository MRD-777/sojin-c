"use client";
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CircleDollarSign, Receipt, Users, BarChart3, Lock, TrendingUp, ScanEye, FileSpreadsheet, Sparkles, Shield, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import MouseBg from "@/components/landing/mouse-bg";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { useTranslations } from "next-intl";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  const obj = useRef({ v: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true; obj.current.v = 0;
        gsap.to(obj.current, { v: target, duration: 2, ease: "power2.out", onUpdate: () => { if (el) el.textContent = Math.round(obj.current.v).toLocaleString("en-US") + suffix; } });
      }
    }, { threshold: 0.3 });
    obs.observe(el); return () => obs.disconnect();
  }, [target, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

export default function HomePage() {
  const t = useTranslations("Landing");
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".ha", 
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.13, ease: "power3.out", delay: 0.3 }
      );
      
      gsap.utils.toArray<HTMLElement>(".rv").forEach(el => {
        gsap.fromTo(el, 
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } }
        );
      });
      
      gsap.utils.toArray<HTMLElement>(".sp").forEach(p => {
        gsap.fromTo(p.querySelectorAll(".si"), 
          { opacity: 0, y: 30, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.08, ease: "power3.out", scrollTrigger: { trigger: p, start: "top 85%" } }
        );
      });
    }, main);
    
    // Refresh ScrollTrigger after a slight delay to ensure all DOM layout is done
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 500);

    return () => {
      clearTimeout(timer);
      ctx.revert();
    };
  }, []);

  return (
    <main ref={main} className="relative min-h-screen bg-[#F8F9FA] dark:bg-[#0f0f12] text-[#1a1a1a] dark:text-neutral-50 overflow-x-hidden transition-colors duration-300" style={{ fontFamily: "'Inter','Cairo',sans-serif" }}>
      <MouseBg />
      <Header />

      {/* HERO */}
      <section className="relative pt-28 pb-32 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-neutral-400/[0.05] dark:bg-white/[0.02] rounded-full blur-[120px] pointer-events-none transition-colors duration-300"/>
        <div className="relative z-10 max-w-[1300px] mx-auto text-center">
          <div className="ha inline-flex items-center gap-2 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-400 text-[13px] font-bold px-5 py-2 rounded-full mb-8 shadow-sm transition-colors duration-300">
            <Sparkles className="w-4 h-4"/> {t("hero_new.tagline")}
          </div>
          <h1 className="ha text-[clamp(2.5rem,6vw,5.5rem)] font-extrabold leading-[1.05] tracking-[-0.04em] max-w-5xl mx-auto mb-8 text-[#111] dark:text-white">
            {t("hero_new.title_1")}<br/>
            <span className="text-neutral-500 dark:text-neutral-400">{t("hero_new.title_highlight")}</span>
          </h1>
          <p className="ha text-neutral-500 dark:text-neutral-400 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed mb-12 font-medium">
            {t("hero_new.desc")}
          </p>
          <div className="ha flex flex-wrap gap-4 justify-center mb-24">
            <Link href="/register" className="inline-flex items-center gap-2 bg-[#111] dark:bg-white text-white dark:text-[#111] text-[16px] font-bold px-9 py-4 rounded-full hover:bg-black dark:hover:bg-neutral-200 transition-all hover:-translate-y-1 shadow-[0_15px_30px_-10px_rgba(0,0,0,0.2)] dark:shadow-[0_15px_30px_-10px_rgba(255,255,255,0.1)]">
              {t("hero_new.demo_btn")} <ArrowUpRight className="w-5 h-5 rtl:rotate-180"/>
            </Link>
            <Link href="#platform" className="inline-flex items-center gap-2 bg-white dark:bg-white/5 text-neutral-700 dark:text-neutral-300 text-[16px] font-bold px-9 py-4 rounded-full hover:bg-neutral-50 dark:hover:bg-white/10 transition-all shadow-sm border border-neutral-200 dark:border-white/10">
              {t("hero_new.explore_btn")}
            </Link>
          </div>
          
          <div className="ha relative max-w-5xl mx-auto">
            <div className="absolute -inset-10 bg-gradient-to-b from-neutral-200/30 dark:from-white/5 to-transparent rounded-[3rem] blur-3xl -z-10 transition-colors duration-300"/>
            <div className="relative rounded-[2rem] border border-neutral-200/50 dark:border-white/10 overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.05)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] bg-white dark:bg-[#111] transition-colors duration-300">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-neutral-100 dark:border-white/5 bg-[#fafafa] dark:bg-[#111]">
                <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700"/><div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700"/><div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700"/></div>
                <div className="mx-auto bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 rounded-md px-32 py-1.5 text-[11px] font-mono text-neutral-400 dark:text-neutral-500 flex items-center gap-2 transition-colors duration-300">
                  <Lock className="w-3 h-3"/> app.sojin.sa
                </div>
              </div>
              <Image src="/images/sojin-dash.png" alt="Sojin Dashboard" width={1200} height={700} className="w-full h-auto bg-neutral-100 dark:bg-[#0f0f12] dark:opacity-90 transition-all duration-300" priority/>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="py-12 rv">
        <div className="max-w-[1300px] mx-auto px-6">
          <p className="text-center text-[12px] text-neutral-400 dark:text-neutral-500 font-bold tracking-widest uppercase mb-8">{t("trust_bar.title")}</p>
          <div className="flex flex-wrap justify-center gap-x-16 gap-y-6 opacity-40 dark:opacity-30 grayscale">
            {(t.raw("trust_bar.companies") as string[]).map((n: string, i: number) => (
              <span key={i} className="text-[18px] font-black tracking-wide text-neutral-800 dark:text-white">{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" className="py-32 px-6 bg-white dark:bg-[#14141a] rounded-[3rem] mx-4 md:mx-10 my-10 shadow-sm border border-neutral-100 dark:border-white/5 transition-colors duration-300">
        <div className="max-w-[1300px] mx-auto">
          <div className="max-w-3xl mb-20 rv">
            <div className="inline-flex items-center gap-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[13px] font-bold px-4 py-1.5 rounded-full mb-6 transition-colors duration-300">
              {t("why.tag")}
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-[-0.03em] mb-6 text-[#1a1a1a] dark:text-white transition-colors duration-300">
              {t("why.title_1")}<br/><span className="text-neutral-400 dark:text-neutral-500">{t("why.title_2")}</span>
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-xl leading-relaxed font-medium transition-colors duration-300">{t("why.desc")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 sp">
            {(t.raw("why.cards") as {t: string; d: string}[]).map((c, i: number) => {
              const icons = [<CircleDollarSign key={0} className="w-6 h-6"/>, <ScanEye key={1} className="w-6 h-6"/>, <FileSpreadsheet key={2} className="w-6 h-6"/>];
              const styles = [
                { c: "text-[#111] dark:text-white", b: "bg-neutral-100 dark:bg-white/10" },
                { c: "text-[#111] dark:text-white", b: "bg-neutral-100 dark:bg-white/10" },
                { c: "text-[#111] dark:text-white", b: "bg-neutral-100 dark:bg-white/10" }
              ];
              return (
                <div key={i} className={`si rounded-[2rem] p-10 bg-[#F8F9FA] dark:bg-[#0f0f12] hover:bg-white dark:hover:bg-[#1a1a24] border border-transparent hover:border-neutral-200 dark:hover:border-white/10 transition-all duration-300 hover:shadow-xl hover:-translate-y-2`}>
                  <div className={`w-14 h-14 rounded-2xl ${styles[i].b} flex items-center justify-center mb-6 ${styles[i].c}`}>{icons[i]}</div>
                  <h3 className="text-2xl font-bold mb-4 text-[#1a1a1a] dark:text-white">{c.t}</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-[16px] leading-relaxed font-medium">{c.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="py-32 px-6">
        <div className="max-w-[1300px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20 rv">
            <div className="inline-flex items-center gap-2 bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 text-[13px] font-bold px-4 py-1.5 rounded-full mb-6 transition-colors duration-300">
              {t("platform.tag")}
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-[-0.03em] text-[#1a1a1a] dark:text-white transition-colors duration-300">
              {t("platform.title_1")}{" "}<br/><span className="text-neutral-500 dark:text-neutral-400">{t("platform.title_highlight")}</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sp">
            {(t.raw("platform.cards") as {t: string; d: string}[]).map((f, i: number) => {
              const icons = [<CircleDollarSign key={0} className="w-6 h-6"/>, <Receipt key={1} className="w-6 h-6"/>, <Users key={2} className="w-6 h-6"/>, <BarChart3 key={3} className="w-6 h-6"/>, <Lock key={4} className="w-6 h-6"/>, <TrendingUp key={5} className="w-6 h-6"/>];
              return (
                <div key={i} className="si group rounded-[2rem] p-10 bg-white dark:bg-[#111] border border-neutral-100 dark:border-white/5 shadow-sm hover:shadow-xl hover:border-neutral-300 dark:hover:border-white/20 transition-all duration-300 hover:-translate-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-50 dark:bg-white/5 flex items-center justify-center mb-6 text-neutral-600 dark:text-neutral-400 group-hover:bg-neutral-100 dark:group-hover:bg-white/10 group-hover:text-[#111] dark:group-hover:text-white transition-colors">{icons[i]}</div>
                  <h3 className="text-2xl font-bold mb-4 text-[#1a1a1a] dark:text-white transition-colors duration-300">{f.t}</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-[16px] leading-relaxed font-medium transition-colors duration-300">{f.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-32 px-6 bg-[#1a1a1a] dark:bg-black text-white rounded-[3rem] mx-4 md:mx-10 my-10 overflow-hidden relative shadow-2xl dark:border dark:border-white/10 transition-colors duration-300">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.03] rounded-full blur-[100px]"/>
        </div>
        <div className="relative z-10 max-w-[1300px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20 rv">
            <h2 className="text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-[-0.03em] mb-6">
              {t("how.title_1")}<br/>{t("how.title_2")} <span className="text-neutral-400">{t("how.title_highlight")}</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 sp">
            {(t.raw("how.steps") as {n: string; t: string; d: string}[]).map((s, i: number) => {
              const icons = [<Sparkles key={0} className="w-6 h-6 text-white"/>, <Shield key={1} className="w-6 h-6 text-white"/>, <Receipt key={2} className="w-6 h-6 text-white"/>, <TrendingUp key={3} className="w-6 h-6 text-white"/>];
              return (
                <div key={i} className="si relative rounded-[2rem] p-10 bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300">
                  <span className="text-[6rem] font-black text-white/5 absolute -top-4 left-6 rtl:left-auto rtl:right-6 leading-none select-none">{s.n}</span>
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-6 backdrop-blur-md">{icons[i]}</div>
                    <h4 className="text-xl font-bold mb-4">{s.t}</h4>
                    <p className="text-white/60 text-[15px] leading-relaxed font-medium">{s.d}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section id="stats" className="py-32 px-6">
        <div className="max-w-[1300px] mx-auto">
          <div className="text-center mb-20 rv">
            <h2 className="text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-[-0.03em] text-[#1a1a1a] dark:text-white transition-colors duration-300">{t("stats.title")}</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sp">
            {(t.raw("stats.cards") as {l: string}[]).map((st, i: number) => {
              const vals = [1200, 4500, 98, 35];
              const suffixes = ["+", "+", "%", "%"];
              return (
                <div key={i} className="si text-center p-12 rounded-[2rem] bg-white dark:bg-[#14141a] border border-neutral-100 dark:border-white/5 shadow-sm transition-colors duration-300">
                  <div className="text-5xl md:text-7xl font-black mb-4 text-[#1a1a1a] dark:text-white tracking-tight transition-colors duration-300">
                    <Counter target={vals[i]} suffix={suffixes[i]}/>
                  </div>
                  <p className="text-neutral-500 dark:text-neutral-400 text-[16px] font-bold transition-colors duration-300">{st.l}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-32 px-6 bg-neutral-50 dark:bg-[#111] rounded-[3rem] mx-4 md:mx-10 my-10 rv border border-transparent dark:border-white/5 shadow-sm transition-colors duration-300">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-7xl mb-8 text-neutral-300 dark:text-neutral-500/30 leading-none transition-colors duration-300">&ldquo;</div>
          <blockquote className="text-3xl md:text-4xl font-extrabold leading-[1.4] tracking-[-0.02em] text-[#1a1a1a] dark:text-white mb-12 transition-colors duration-300">
            {t("testimonial.quote")}
          </blockquote>
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-full bg-black dark:bg-white flex items-center justify-center font-bold text-lg text-white dark:text-black shadow-lg transition-colors duration-300">
              {t("testimonial.author").substring(3, 4)}
            </div>
            <div className="text-start">
              <p className="font-bold text-lg text-[#1a1a1a] dark:text-white transition-colors duration-300">{t("testimonial.author")}</p>
              <p className="text-[15px] font-medium text-neutral-500 dark:text-neutral-400 transition-colors duration-300">{t("testimonial.role")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 rv">
        <div className="max-w-5xl mx-auto text-center relative">
          <div className="absolute inset-0 bg-neutral-200/50 dark:bg-white/5 rounded-[3rem] blur-3xl -z-10 transition-colors duration-300"/>
          <div className="relative rounded-[3rem] bg-white dark:bg-[#111] border border-neutral-100 dark:border-white/5 shadow-xl dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] px-8 py-24 transition-colors duration-300">
            <h2 className="text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-[-0.03em] mb-8 text-[#1a1a1a] dark:text-white transition-colors duration-300">
              {t("cta.title_1")}{" "}<span className="text-neutral-500 dark:text-neutral-400">{t("cta.title_highlight")}</span>
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-2xl mb-12 font-medium max-w-2xl mx-auto transition-colors duration-300">
              {t("cta.desc")}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/register" className="inline-flex items-center gap-2 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] text-[18px] font-bold px-10 py-5 rounded-full hover:bg-neutral-800 dark:hover:bg-neutral-200 hover:scale-105 transition-all shadow-[0_15px_30px_-10px_rgba(0,0,0,0.3)]">
                {t("cta.btn_1")} <ArrowUpRight className="w-5 h-5 rtl:rotate-180"/>
              </Link>
              <Link href="#" className="inline-flex items-center gap-2 bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 text-[18px] font-bold px-10 py-5 rounded-full hover:bg-neutral-200 dark:hover:bg-white/10 transition-all border border-transparent hover:border-neutral-300 dark:hover:border-white/20">
                {t("cta.btn_2")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

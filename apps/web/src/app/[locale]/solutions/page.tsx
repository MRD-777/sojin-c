"use client";
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CircleDollarSign, Receipt, Users, BarChart3, Lock, Shield, HardHat, FileSpreadsheet, ArrowUpRight, Zap } from "lucide-react";
import Link from "next/link";
import MouseBg from "@/components/landing/mouse-bg";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export default function SolutionsPage() {
  const main = useRef<HTMLElement>(null);
  
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".ha", { opacity: 0, y: 40, duration: 1, stagger: 0.1, ease: "power3.out" });
      gsap.utils.toArray<HTMLElement>(".rv").forEach(el => {
        gsap.from(el, { opacity: 0, y: 30, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } });
      });
      gsap.utils.toArray<HTMLElement>(".sp").forEach(p => {
        gsap.from(p.querySelectorAll(".si"), { opacity: 0, y: 30, scale: 0.95, duration: 0.6, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: p, start: "top 80%" } });
      });
    }, main);
    return () => ctx.revert();
  }, []);

  return (
    <main ref={main} className="relative min-h-screen bg-[#F8F9FA] dark:bg-[#0f0f12] text-[#1a1a1a] dark:text-neutral-50 overflow-x-hidden transition-colors duration-300" style={{ fontFamily: "'Inter','Cairo',sans-serif" }}>
      <MouseBg />
      <Header />

      {/* HERO */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-neutral-400/[0.08] dark:bg-neutral-400/[0.05] rounded-full blur-[120px] pointer-events-none transition-colors duration-300"/>
        <div className="relative z-10 max-w-[1300px] mx-auto text-center">
          <div className="ha inline-flex items-center gap-2 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-[#1a1a1a] dark:text-white text-[13px] font-bold px-5 py-2 rounded-full mb-8 shadow-sm transition-colors duration-300">
            <Zap className="w-4 h-4"/> الحلول والمميزات
          </div>
          <h1 className="ha text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-[-0.03em] max-w-4xl mx-auto mb-8 text-[#1a1a1a] dark:text-white">
            منظومة متكاملة <br/>
            <span className="text-neutral-500 dark:text-neutral-400">لكل تحديات مشاريعك.</span>
          </h1>
          <p className="ha text-neutral-500 dark:text-neutral-400 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed font-medium mb-12">
            تم تصميم سوجين ليكون العمود الفقري لإدارة أعمال المقاولات. من أصغر عهدة نقدية إلى أضخم مستخلص، كل شيء مسجل، مؤتمت، وموثوق.
          </p>
        </div>
      </section>

      {/* CORE SOLUTIONS */}
      <section className="py-16 px-6">
        <div className="max-w-[1300px] mx-auto space-y-32">
          
          {/* Feature 1 */}
          <div className="grid md:grid-cols-2 gap-12 items-center rv">
            <div className="order-2 md:order-1 relative rounded-[2.5rem] bg-neutral-50 dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/5 p-8 h-[400px] overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 dark:opacity-[0.03] pointer-events-none"/>
              <CircleDollarSign className="w-48 h-48 text-neutral-400 opacity-20 absolute -right-10 -bottom-10"/>
              <div className="relative z-10 bg-white dark:bg-[#14141a] p-6 rounded-2xl shadow-xl border border-neutral-100 dark:border-white/5 max-w-sm w-full">
                <div className="flex justify-between items-center mb-4 border-b border-neutral-100 dark:border-white/10 pb-4">
                  <span className="font-bold text-[#1a1a1a] dark:text-white">تصفية عهدة - الأسمنت</span>
                  <span className="text-neutral-400 dark:text-neutral-500 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full text-sm">مُعتمدة</span>
                </div>
                <div className="space-y-3">
                  <div className="h-3 bg-neutral-100 dark:bg-white/5 rounded-full w-3/4"/>
                  <div className="h-3 bg-neutral-100 dark:bg-white/5 rounded-full w-1/2"/>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 flex items-center justify-center mb-6">
                <CircleDollarSign className="w-6 h-6"/>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-[#1a1a1a] dark:text-white">إدارة العُهد والمصروفات</h2>
              <p className="text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium mb-6">
                قضِ على التسرب المالي والفواتير الضائعة. مهندس الموقع يمكنه رفع الفواتير بالكاميرا فورياً وتوجيهها للمحاسب للمطابقة. لا يوجد مبلغ معلق بدون تبرير، والموافقات تتم بضغطة زر.
              </p>
              <ul className="space-y-4">
                {["تصوير ورفع الفواتير من الجوال","توجيه آلي للاعتماد الإداري","ربط مباشر ببند التكلفة في المشروع"].map((f,i)=>(
                  <li key={i} className="flex items-center gap-3 text-[#1a1a1a] dark:text-neutral-300 font-medium">
                    <CheckCircle className="w-5 h-5 text-neutral-400 dark:text-neutral-500"/> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="grid md:grid-cols-2 gap-12 items-center rv">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-6 h-6"/>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-[#1a1a1a] dark:text-white">إدارة المستخلصات بدقة</h2>
              <p className="text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium mb-6">
                النهاية الأكيدة للخلافات مع المقاولين من الباطن. النظام يصدر المستخلصات بناءً على الكميات المنفذة الفعلية في الموقع والتي تم اعتمادها مسبقاً، مع خصم الدفعات المقدمة والضرائب تلقائياً.
              </p>
              <ul className="space-y-4">
                {["احتساب آلي للمتبقي والمنصرف","منع تجاوز كميات العقد","أرشفة إلكترونية كاملة لكل مستخلص"].map((f,i)=>(
                  <li key={i} className="flex items-center gap-3 text-[#1a1a1a] dark:text-neutral-300 font-medium">
                    <CheckCircle className="w-5 h-5 text-neutral-400 dark:text-neutral-500"/> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative rounded-[2.5rem] bg-neutral-50 dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/5 p-8 h-[400px] overflow-hidden flex items-center justify-center">
              <FileSpreadsheet className="w-48 h-48 text-neutral-400 opacity-20 absolute -left-10 -bottom-10"/>
              <div className="relative z-10 bg-white dark:bg-[#14141a] p-6 rounded-2xl shadow-xl border border-neutral-100 dark:border-white/5 max-w-sm w-full">
                <div className="text-center mb-6">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400 font-bold block mb-1">المستخلص الجاري #04</span>
                  <span className="text-3xl font-black text-[#1a1a1a] dark:text-white">124,500 <span className="text-lg text-neutral-400">ر.س</span></span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] py-2 rounded-lg font-bold text-sm">اعتماد وصرف</button>
                  <button className="flex-1 bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white py-2 rounded-lg font-bold text-sm">رفض</button>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="grid md:grid-cols-2 gap-12 items-center rv">
            <div className="order-2 md:order-1 relative rounded-[2.5rem] bg-neutral-50 dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/5 p-8 h-[400px] overflow-hidden flex items-center justify-center">
              <HardHat className="w-48 h-48 text-neutral-400 opacity-20 absolute -right-10 -top-10"/>
              <div className="relative z-10 bg-white dark:bg-[#14141a] p-6 rounded-2xl shadow-xl border border-neutral-100 dark:border-white/5 max-w-sm w-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center"><Users className="w-6 h-6 text-neutral-500"/></div>
                  <div>
                    <h4 className="font-bold text-[#1a1a1a] dark:text-white">فريق التشطيبات</h4>
                    <p className="text-sm text-neutral-500">12 عامل متواجد</p>
                  </div>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white text-center py-2 rounded-lg font-bold text-sm">
                  تم تسجيل الحضور اليوم
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white flex items-center justify-center mb-6">
                <Users className="w-6 h-6"/>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-[#1a1a1a] dark:text-white">يوميات العمالة والمعدات</h2>
              <p className="text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium mb-6">
                اعرف بدقة أين تُصرف أجور العمال وكيف تُستخدم معداتك. تحضير يومي من الموقع يحسب التكلفة تلقائياً ويوزعها على بنود التكلفة (Cost Centers).
              </p>
              <ul className="space-y-4">
                {["تتبع إنتاجية وحضور العمالة","توزيع التكاليف على البنود المعمارية","تقييم أداء المعدات الثقيلة والمستأجرة"].map((f,i)=>(
                  <li key={i} className="flex items-center gap-3 text-[#1a1a1a] dark:text-neutral-300 font-medium">
                    <CheckCircle className="w-5 h-5 text-neutral-400 dark:text-neutral-500"/> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section className="py-24 px-6 bg-white dark:bg-[#14141a] rounded-[3rem] mx-4 md:mx-10 my-10 shadow-sm border border-neutral-100 dark:border-white/5 transition-colors duration-300 rv">
        <div className="max-w-[1300px] mx-auto text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white flex items-center justify-center mb-6">
            <BarChart3 className="w-6 h-6"/>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6 text-[#1a1a1a] dark:text-white transition-colors duration-300">
            لوحة قياس الأرباح (P&L)
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl max-w-2xl mx-auto font-medium mb-16">
            جميع البيانات التي يتم إدخالها من الموقع تتجمع في مكان واحد لتعطيك صورة واضحة: هل يربح المشروع أم يخسر؟ 
          </p>
          <div className="grid md:grid-cols-3 gap-6 sp text-right">
            {[
              {t:"تكاليف لحظية", d:"تحديث فوري لكل تكلفة جديدة تدخل النظام، لتقارنها بالموازنة المخططة."},
              {t:"تنبيه الانحرافات", d:"تتلقى تنبيهاً مباشراً في حال زاد الصرف في أي بند عن الحد المعتمد."},
              {t:"أرباح واضحة", d:"معرفة مقدار التدفقات النقدية والأرباح الصافية الحالية لكل مشروع منفصل."},
            ].map((f,i)=>(
              <div key={i} className="si p-8 bg-[#F8F9FA] dark:bg-[#0f0f12] rounded-2xl border border-neutral-100 dark:border-white/5 transition-colors duration-300">
                <h4 className="text-xl font-bold mb-3 text-[#1a1a1a] dark:text-white">{f.t}</h4>
                <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 rv">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6 text-[#1a1a1a] dark:text-white transition-colors duration-300">كل هذه الحلول متاحة بضغطة زر</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl mb-10 font-medium">ابدأ الآن وقم بترقية نظام شركتك إلى العصر الرقمي الحديث.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] text-[18px] font-bold px-10 py-5 rounded-full hover:bg-neutral-800 dark:hover:bg-neutral-200 hover:scale-105 transition-all shadow-xl">
            تجربة المنصة الآن <ArrowUpRight className="w-5 h-5"/>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}

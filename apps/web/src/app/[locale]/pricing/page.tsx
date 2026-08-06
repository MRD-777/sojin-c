"use client";
import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Check, X, ArrowUpRight, HelpCircle, Building2, Rocket, Briefcase } from "lucide-react";
import Link from "next/link";
import MouseBg from "@/components/landing/mouse-bg";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const faqs = [
  { q: "هل يوجد فترة تجريبية مجانية؟", a: "نعم، نقدم فترة تجريبية مجانية لمدة 14 يوماً للباقة الاحترافية بكامل مميزاتها، لتتمكن من تجربة المنصة ببيانات مشاريعك الحقيقية قبل اتخاذ القرار." },
  { q: "هل يمكنني ترقية أو إلغاء اشتراكي في أي وقت؟", a: "بالتأكيد. يمكنك الترقية إلى باقة أعلى في أي وقت وسيتم حساب الفارق النسبي فقط. كما يمكنك إلغاء التجديد التلقائي متى شئت." },
  { q: "كيف يتم حساب عدد المستخدمين؟", a: "يُحسب بناءً على عدد الحسابات النشطة التي يمكنها تسجيل الدخول إلى النظام (مثل المهندسين، المحاسبين، الإدارة). العمال المضافون في النظام لا يُحسبون كمستخدمين." },
  { q: "هل بياناتي آمنة؟", a: "نحن نستخدم أحدث بروتوكولات التشفير وخوادم سحابية محمية ومستضافة محلياً لضمان سرية وأمان بياناتك بنسبة 100%." }
];

export default function PricingPage() {
  const main = useRef<HTMLElement>(null);
  const [isAnnual, setIsAnnual] = useState(true);

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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-neutral-400/[0.08] dark:bg-neutral-400/[0.05] rounded-full blur-[120px] pointer-events-none transition-colors duration-300" />
        <div className="relative z-10 max-w-[1300px] mx-auto text-center">
          <h1 className="ha text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-[-0.03em] max-w-4xl mx-auto mb-6 text-[#1a1a1a] dark:text-white">
            استثمار يغطي تكلفته<br />
            <span className="text-neutral-500 dark:text-neutral-400">من أول شهر.</span>
          </h1>
          <p className="ha text-neutral-500 dark:text-neutral-400 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-medium mb-12">
            باقات مرنة ومصممة خصيصاً لتناسب حجم شركتك. ما ستدفعه هنا هو جزء بسيط جداً مما ستوفره من إيقاف الهدر المالي.
          </p>

          {/* TOGGLE */}
          <div className="ha flex items-center justify-center gap-4 mb-16">
            <span className={`text-[16px] font-bold transition-colors ${!isAnnual ? 'text-[#1a1a1a] dark:text-white' : 'text-neutral-400'}`}>شهري</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-16 h-8 rounded-full bg-neutral-200 dark:bg-white/10 transition-colors duration-300 focus:outline-none"
            >
              <div className={`absolute top-1 w-6 h-6 rounded-full bg-[#1a1a1a] dark:bg-white shadow-sm transition-transform duration-300 ${isAnnual ? 'left-1 -translate-x-0' : 'translate-x-8'}`} />
            </button>
            <span className={`text-[16px] font-bold transition-colors flex items-center gap-2 ${isAnnual ? 'text-[#1a1a1a] dark:text-white' : 'text-neutral-400'}`}>
              سنوي <span className="bg-neutral-200 text-[#1a1a1a] dark:bg-white/10 dark:text-white text-[11px] px-2 py-0.5 rounded-full">وفر 20%</span>
            </span>
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section className="pb-32 px-6">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-3 gap-8 sp items-center">
          {/* STARTER */}
          <div className="si bg-white dark:bg-[#14141a] rounded-[2rem] p-8 border border-neutral-100 dark:border-white/5 shadow-sm transition-colors duration-300">
            <div className="w-12 h-12 bg-neutral-100 dark:bg-white/5 rounded-xl flex items-center justify-center mb-6 text-neutral-600 dark:text-neutral-400"><Rocket className="w-6 h-6" /></div>
            <h3 className="text-2xl font-bold mb-2 text-[#1a1a1a] dark:text-white">باقة الانطلاق</h3>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">للمقاولين الصغار والمشاريع المحدودة.</p>
            <div className="mb-8 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-[#1a1a1a] dark:text-white">{isAnnual ? '299' : '399'}</span>
              <span className="text-neutral-500 dark:text-neutral-400">ريال / شهرياً</span>
            </div>
            <Link href="/register?plan=starter" className="block w-full py-4 text-center rounded-xl bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white font-bold hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors mb-8">
              ابدأ الآن
            </Link>
            <ul className="space-y-4">
              {[
                { t: "إدارة 3 مشاريع نشطة", a: true },
                { t: "حتى 5 مستخدمين", a: true },
                { t: "إدارة العهد والمصروفات", a: true },
                { t: "تقارير أساسية", a: true },
                { t: "مستخلصات المقاولين", a: false },
                { t: "نظام صلاحيات متقدم", a: false },
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-[15px] font-medium text-neutral-600 dark:text-neutral-300">
                  {f.a ? <Check className="w-5 h-5 text-neutral-400 dark:text-neutral-500" /> : <X className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />}
                  {f.t}
                </li>
              ))}
            </ul>
          </div>

          {/* PRO */}
          <div className="si bg-[#1a1a1a] dark:bg-white rounded-[2rem] p-8 border-2 border-[#1a1a1a] dark:border-white shadow-2xl relative transform lg:-translate-y-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] border border-[#1a1a1a] dark:border-neutral-200 text-[12px] font-bold px-4 py-1 rounded-full">الأكثر طلباً</div>
            <div className="w-12 h-12 bg-white/20 dark:bg-black/5 rounded-xl flex items-center justify-center mb-6 text-white dark:text-[#1a1a1a] backdrop-blur-sm"><Briefcase className="w-6 h-6" /></div>
            <h3 className="text-2xl font-bold mb-2 text-white dark:text-[#1a1a1a]">الباقة الاحترافية</h3>
            <p className="text-neutral-400 dark:text-neutral-500 text-sm mb-6">للشركات المتوسطة التي تبحث عن تحكم كامل.</p>
            <div className="mb-8 flex items-baseline gap-2 text-white dark:text-[#1a1a1a]">
              <span className="text-4xl font-extrabold">{isAnnual ? '699' : '899'}</span>
              <span className="text-neutral-400 dark:text-neutral-500">ريال / شهرياً</span>
            </div>
            <Link href="/register?plan=pro" className="block w-full py-4 text-center rounded-xl bg-white dark:bg-[#1a1a1a] text-[#1a1a1a] dark:text-white font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-lg mb-8">
              جرب مجاناً لمدة 14 يوم
            </Link>
            <ul className="space-y-4">
              {[
                { t: "إدارة مشاريع غير محدودة", a: true },
                { t: "حتى 20 مستخدماً", a: true },
                { t: "إدارة العهد والمصروفات كاملة", a: true },
                { t: "تقارير تنفيذية متقدمة", a: true },
                { t: "مستخلصات وإدارة عقود", a: true },
                { t: "نظام صلاحيات متقدم", a: true },
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-[15px] font-medium text-white dark:text-[#1a1a1a]">
                  <Check className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
                  {f.t}
                </li>
              ))}
            </ul>
          </div>

          {/* ENTERPRISE */}
          <div className="si bg-white dark:bg-[#14141a] rounded-[2rem] p-8 border border-neutral-100 dark:border-white/5 shadow-sm transition-colors duration-300">
            <div className="w-12 h-12 bg-neutral-100 dark:bg-white/5 rounded-xl flex items-center justify-center mb-6 text-neutral-600 dark:text-neutral-400"><Building2 className="w-6 h-6" /></div>
            <h3 className="text-2xl font-bold mb-2 text-[#1a1a1a] dark:text-white">باقة الشركات</h3>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">للمشاريع الضخمة التي تحتاج متطلبات خاصة.</p>
            <div className="mb-8 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-[#1a1a1a] dark:text-white">مخصص</span>
            </div>
            <Link href="/contact" className="block w-full py-4 text-center rounded-xl bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white font-bold hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors mb-8">
              تواصل مع المبيعات
            </Link>
            <ul className="space-y-4">
              {[
                { t: "كل مميزات الباقة الاحترافية", a: true },
                { t: "عدد مستخدمين غير محدود", a: true },
                { t: "مدير حساب مخصص", a: true },
                { t: "دعم فني على مدار الساعة", a: true },
                { t: "ربط API مع أنظمة أخرى (ERP)", a: true },
                { t: "تدريب أونسايت للموظفين", a: true },
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-[15px] font-medium text-neutral-600 dark:text-neutral-300">
                  <Check className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
                  {f.t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-white dark:bg-[#14141a] rounded-[3rem] mx-4 md:mx-10 my-10 shadow-sm border border-neutral-100 dark:border-white/5 transition-colors duration-300 rv">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-6 text-[#1a1a1a] dark:text-white transition-colors duration-300">الأسئلة الشائعة</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-lg font-medium">كل ما تحتاج معرفته عن الاشتراكات والدفع.</p>
          </div>
          <div className="space-y-6">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-[#F8F9FA] dark:bg-[#0f0f12] border border-neutral-100 dark:border-white/5 transition-colors duration-300">
                <h4 className="flex items-center gap-3 text-lg font-bold text-[#1a1a1a] dark:text-white mb-3">
                  <HelpCircle className="w-5 h-5 text-neutral-500 dark:text-neutral-400" /> {faq.q}
                </h4>
                <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed pr-8 font-medium">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 rv">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6 text-[#1a1a1a] dark:text-white transition-colors duration-300">هل لديك احتياجات خاصة؟</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl mb-10 font-medium">فريق المبيعات لدينا مستعد لتصميم باقة تناسب متطلبات شركتك بالضبط.</p>
          <Link href="/contact" className="inline-flex items-center gap-2 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] text-[18px] font-bold px-10 py-5 rounded-full hover:bg-neutral-800 dark:hover:bg-neutral-200 hover:scale-105 transition-all shadow-xl">
            تواصل معنا الآن <ArrowUpRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

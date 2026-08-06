"use client";
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Target, Flag, Zap, Users, ArrowUpRight, ShieldCheck, TrendingUp, Building2 } from "lucide-react";
import Link from "next/link";
import MouseBg from "@/components/landing/mouse-bg";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export default function AboutPage() {
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
            <Building2 className="w-4 h-4"/> عن سوجين
          </div>
          <h1 className="ha text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-[-0.03em] max-w-4xl mx-auto mb-8 text-[#1a1a1a] dark:text-white">
            نحن نعيد هندسة <br/>
            <span className="text-neutral-500 dark:text-neutral-400">قطاع المقاولات.</span>
          </h1>
          <p className="ha text-neutral-500 dark:text-neutral-400 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed font-medium mb-12">
            بدأت سوجين من موقع بناء حقيقي، حيث رأينا بأعيننا كيف تضيع الأرباح بين أكوام الورق، وكيف تُتخذ القرارات المصيرية بناءً على تخمينات. نحن هنا لنغيّر ذلك للأبد.
          </p>
        </div>
      </section>

      {/* OUR STORY */}
      <section className="py-20 px-6 rv">
        <div className="max-w-[1000px] mx-auto bg-white dark:bg-[#14141a] rounded-[3rem] p-10 md:p-16 shadow-xl border border-neutral-100 dark:border-white/5 relative overflow-hidden transition-colors duration-300">
          <div className="absolute top-0 right-0 w-64 h-64 bg-neutral-100 dark:bg-white/5 rounded-full blur-3xl -z-10 transition-colors duration-300"/>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-[#1a1a1a] dark:text-white">قصتنا: من الألم إلى الحل</h2>
          <div className="space-y-6 text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium">
            <p>
              لعقود طويلة، ظلت شركات المقاولات تعمل بطرق تقليدية مرهقة. المهندس يكتب طلباته على ورقة، المحاسب يطارد الفواتير الضائعة، والمدير يكتشف خسارة المشروع بعد تسليمه!
            </p>
            <p>
              في عام ٢٠٢٤، قررنا أن هذا العبث يجب أن يتوقف. جمعنا نخبة من المهندسين المدنيين وخبراء التقنية المالية لنبني <strong className="text-[#1a1a1a] dark:text-white">"سوجين"</strong>. لم نقم ببناء مجرد برنامج محاسبي، بل بنينا "عقلاً مدبراً" يفهم لغة المقاولات، يراقب كل مسمار يُشترى، وكل ساعة عمل تُسجل، ويربطها فوراً بالميزانية المعتمدة.
            </p>
            <p>
              اليوم، سوجين هو الدرع الواقي لأرباح مئات المشاريع، والعيون التي لا تنام لمدراء الشركات.
            </p>
          </div>
        </div>
      </section>

      {/* MISSION & VISION */}
      <section className="py-24 px-6">
        <div className="max-w-[1300px] mx-auto grid md:grid-cols-2 gap-8 sp">
          <div className="si rounded-[2.5rem] p-12 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-20"><Target className="w-32 h-32"/></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 dark:bg-black/5 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-md">
                <Target className="w-8 h-8"/>
              </div>
              <h3 className="text-3xl font-extrabold mb-4">مهمتنا</h3>
              <p className="opacity-90 text-lg leading-relaxed font-medium">
                تمكين شركات المقاولات من السيطرة التامة على بياناتها ومواردها المالية، والقضاء على الهدر المالي والإداري من خلال تقنيات سحابية ذكية وسهلة الاستخدام للجميع، من العامل في الموقع إلى المدير التنفيذي.
              </p>
            </div>
          </div>
          <div className="si rounded-[2.5rem] p-12 bg-[#1a1a1a] dark:bg-[#1a1a24] text-white relative overflow-hidden shadow-2xl border border-transparent dark:border-white/5 transition-colors duration-300">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Flag className="w-32 h-32"/></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/10 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-md">
                <Flag className="w-8 h-8 text-white dark:text-[#1a1a1a]"/>
              </div>
              <h3 className="text-3xl font-extrabold mb-4">رؤيتنا</h3>
              <p className="opacity-70 text-lg leading-relaxed font-medium">
                أن نصبح المعيار الذهبي والبنية التحتية الرقمية الأساسية لقطاع التشييد والبناء في الشرق الأوسط، حيث لا يبدأ أي مشروع بناء ناجح إلا وتكون منصة سوجين هي المحرك الأساسي له.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="py-24 px-6">
        <div className="max-w-[1300px] mx-auto">
          <div className="text-center mb-16 rv">
            <h2 className="text-4xl font-extrabold text-[#1a1a1a] dark:text-white transition-colors duration-300">قيمنا التي لا نساوم عليها</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 sp">
            {[
              {icon:<ShieldCheck className="w-6 h-6"/>, t:"الشفافية المطلقة", d:"نؤمن بأن البيانات الواضحة هي أساس الثقة. منصتنا مصممة لتكشف الحقائق، لا لتخفيها."},
              {icon:<Zap className="w-6 h-6"/>, t:"السرعة والبساطة", d:"وقتك ثمين. صممنا سوجين ليكون بديهياً، لا يحتاج لتدريب معقد، وينجز المهام في ثوانٍ."},
              {icon:<Users className="w-6 h-6"/>, t:"شراكة حقيقية", d:"نجاحنا يقاس بمدى نمو أعمالك. نحن لسنا مجرد مزود خدمة، بل شركاء في حماية أرباحك."},
            ].map((v, i) => (
              <div key={i} className="si bg-white dark:bg-[#14141a] p-10 rounded-[2rem] border border-neutral-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="w-14 h-14 bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300">
                  {v.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-[#1a1a1a] dark:text-white transition-colors duration-300">{v.t}</h3>
                <p className="text-neutral-500 dark:text-neutral-400 text-lg leading-relaxed font-medium transition-colors duration-300">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 rv">
        <div className="max-w-4xl mx-auto text-center bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] rounded-[3rem] p-16 shadow-2xl dark:shadow-none">
          <h2 className="text-4xl font-extrabold mb-6">كن جزءاً من قصة نجاحنا القادمة</h2>
          <p className="opacity-80 text-xl mb-10 max-w-2xl mx-auto font-medium">
            انضم إلى مئات الشركات التي اتخذت القرار الذكي وحوّلت إدارتها إلى إدارة رقمية محكمة مع سوجين.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-[#1a1a1a] dark:bg-[#1a1a1a] dark:text-white text-[18px] font-bold px-10 py-5 rounded-full hover:scale-105 transition-all shadow-xl">
            ابدأ رحلة التحول الآن <ArrowUpRight className="w-5 h-5"/>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

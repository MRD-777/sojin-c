"use client";
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Mail, Phone, MapPin, Send, MessageSquare } from "lucide-react";
import MouseBg from "@/components/landing/mouse-bg";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export default function ContactPage() {
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".ha", { opacity: 0, y: 40, duration: 1, stagger: 0.1, ease: "power3.out" });
      gsap.utils.toArray<HTMLElement>(".rv").forEach(el => {
        gsap.from(el, { opacity: 0, y: 30, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } });
      });
    }, main);
    return () => ctx.revert();
  }, []);

  return (
    <main ref={main} className="relative min-h-screen bg-[#F8F9FA] dark:bg-[#0f0f12] text-[#1a1a1a] dark:text-neutral-50 overflow-x-hidden transition-colors duration-300" style={{ fontFamily: "'Inter','Cairo',sans-serif" }}>
      <MouseBg />
      <Header />

      {/* HERO */}
      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-neutral-400/[0.08] dark:bg-neutral-400/[0.05] rounded-full blur-[120px] pointer-events-none transition-colors duration-300" />
        <div className="relative z-10 max-w-[1300px] mx-auto text-center">
          <div className="ha inline-flex items-center gap-2 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-[#1a1a1a] dark:text-white text-[13px] font-bold px-5 py-2 rounded-full mb-8 shadow-sm transition-colors duration-300">
            <MessageSquare className="w-4 h-4" /> تواصل معنا
          </div>
          <h1 className="ha text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-[-0.03em] max-w-4xl mx-auto mb-6 text-[#1a1a1a] dark:text-white">
            كيف يمكننا مساعدتك <br />
            <span className="text-neutral-500 dark:text-neutral-400">في بناء المستقبل؟</span>
          </h1>
          <p className="ha text-neutral-500 dark:text-neutral-400 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-medium mb-12">
            فريقنا من الخبراء جاهز للإجابة على استفساراتك، سواء كانت عن المبيعات، أو الدعم الفني، أو بناء شراكة.
          </p>
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section className="pb-32 px-6">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-5 gap-8 rv items-start">

          {/* INFO BOX */}
          <div className="lg:col-span-2 bg-[#1a1a1a] dark:bg-[#1a1a24] text-white rounded-[2rem] p-10 shadow-2xl relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-neutral-500/20 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-extrabold mb-8">معلومات التواصل</h3>
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/10">
                    <MapPin className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold mb-1">المقر الرئيسي</h4>
                    <p className="text-white/60 leading-relaxed text-[15px]">طريق الملك فهد، العليا،<br />الرياض، المملكة العربية السعودية</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/10">
                    <Mail className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold mb-1">البريد الإلكتروني</h4>
                    <p className="text-white/60 leading-relaxed text-[15px]">sales@sojin.sa<br />support@sojin.sa</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/10">
                    <Phone className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold mb-1">الهاتف الموحد</h4>
                    <p className="text-white/60 leading-relaxed text-[15px]">9200 00000</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FORM */}
          <div className="lg:col-span-3 bg-white dark:bg-[#14141a] rounded-[2rem] p-10 border border-neutral-100 dark:border-white/5 shadow-sm transition-colors duration-300">
            <h3 className="text-2xl font-bold mb-8 text-[#1a1a1a] dark:text-white">أرسل لنا رسالة</h3>
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300">الاسم الكامل</label>
                  <input type="text" placeholder="محمد أحمد" className="w-full bg-[#F8F9FA] dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#1a1a1a] dark:focus:border-white focus:ring-1 focus:ring-[#1a1a1a] dark:focus:ring-white transition-all text-[#1a1a1a] dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300">رقم الهاتف</label>
                  <input type="tel" placeholder="05x xxx xxxx" className="w-full bg-[#F8F9FA] dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#1a1a1a] dark:focus:border-white focus:ring-1 focus:ring-[#1a1a1a] dark:focus:ring-white transition-all text-[#1a1a1a] dark:text-white text-left" dir="ltr" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300">البريد الإلكتروني</label>
                <input type="email" placeholder="email@company.com" className="w-full bg-[#F8F9FA] dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#1a1a1a] dark:focus:border-white focus:ring-1 focus:ring-[#1a1a1a] dark:focus:ring-white transition-all text-[#1a1a1a] dark:text-white text-left" dir="ltr" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300">نوع الاستفسار</label>
                <select className="w-full bg-[#F8F9FA] dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#1a1a1a] dark:focus:border-white focus:ring-1 focus:ring-[#1a1a1a] dark:focus:ring-white transition-all text-[#1a1a1a] dark:text-white appearance-none">
                  <option>طلب عرض توضيحي (مبيعات)</option>
                  <option>دعم فني</option>
                  <option>شراكة استراتيجية</option>
                  <option>أخرى</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300">الرسالة</label>
                <textarea rows={4} placeholder="كيف يمكننا مساعدتك؟" className="w-full bg-[#F8F9FA] dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#1a1a1a] dark:focus:border-white focus:ring-1 focus:ring-[#1a1a1a] dark:focus:ring-white transition-all text-[#1a1a1a] dark:text-white resize-none" />
              </div>
              <button className="w-full bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] font-bold text-[16px] py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-lg">
                إرسال الرسالة <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

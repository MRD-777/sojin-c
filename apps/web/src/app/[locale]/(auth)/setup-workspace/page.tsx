"use client";

import { useRouter } from "@/i18n/routing";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AuthNav } from "@/components/navigation/auth-nav";
import { useAuthStore } from "@/store/use-auth-store";
import { useRegister } from "@/lib/auth/use-auth";
import { buildRegisterPayload } from "@/lib/auth/register-payload";

export default function SetupWorkspacePage() {
  const t = useTranslations("Auth.setupWorkspace");
  const router = useRouter();
  const pendingRegistration = useAuthStore((s) => s.pendingRegistration);
  const { register, isPending, error } = useRegister();

  // Step-1 creds live in memory only — lost on a hard refresh. Without them
  // there is nothing to register, so bounce back to /register.
  useEffect(() => {
    if (!pendingRegistration) router.replace("/register");
  }, [pendingRegistration, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pendingRegistration) {
      router.replace("/register");
      return;
    }
    const form = new FormData(e.currentTarget);
    // Only companyName reaches the backend (D1). The other company fields are
    // collected in the UI but not yet transmitted — TODO: persist via
    // /companies once supported.
    const payload = buildRegisterPayload(pendingRegistration, {
      companyName: String(form.get("companyName") ?? ""),
    });

    const outcome = await register(payload);
    if (outcome === "success") {
      router.push("/dashboard");
    } else if (outcome === "autologin-failed") {
      // Account created but auto-login failed (P2) → let them sign in manually.
      router.push("/login");
    }
    // "register-failed" → stay on the form; the error banner shows why.
  }

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] dark:bg-[#050505] text-[#111] dark:text-[#e0e0e0] font-sans selection:bg-black/10 dark:selection:bg-white/20 transition-colors duration-500">
      
      <AuthNav />

      {/* Right Architectural Image Panel */}
      <div className="hidden lg:block relative w-[45%] xl:w-[50%] overflow-hidden">
        <Image
          className="absolute inset-0 h-full w-full object-cover opacity-80 dark:opacity-60 dark:mix-blend-luminosity scale-105"
          src="/images/setup-bg.png"
          alt="Premium Architecture"
          fill
          priority
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-[#fcfcfc] via-transparent to-[#fcfcfc]/80 dark:from-[#050505] dark:via-transparent dark:to-[#050505]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#fcfcfc] via-transparent to-transparent dark:from-[#050505]" />
      </div>

      {/* Left Form Panel */}
      <div className="flex w-full lg:w-[55%] xl:w-[50%] flex-col justify-center px-8 sm:px-16 xl:px-24 relative z-10 py-12">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg mx-auto lg:mx-0"
        >
          {/* Logo / Brand */}
          <div className="inline-block mb-12 opacity-80 relative">
            <div className="w-10 h-10 border border-black/20 dark:border-white/20 flex items-center justify-center relative">
              <div className="w-2 h-2 bg-[#111] dark:bg-white rounded-full"></div>
              <div className="absolute -inset-1 border border-black/5 dark:border-white/5"></div>
            </div>
          </div>
          
          <div className="mb-12">
            <h2 className="text-3xl font-light text-[#111] dark:text-white mb-2">{t("title")}</h2>
            <p className="text-[#666] text-sm tracking-wide">{t("subtitle")}</p>
          </div>

          <form className="space-y-10" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-s-2 border-[#ef4444] px-4 py-2 text-[#ef4444] text-xs uppercase tracking-wider bg-[#ef4444]/5"
              >
                {error.message}
              </motion.div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
              {/* Company Name */}
              <div className="relative group md:col-span-2">
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("companyName")}
                />
                <label 
                  htmlFor="companyName" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("companyName")}
                </label>
              </div>

              {/* Commercial Register */}
              <div className="relative group">
                <input
                  id="commercialRegister"
                  name="commercialRegister"
                  type="text"
                  required
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("commercialRegister")}
                />
                <label 
                  htmlFor="commercialRegister" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("commercialRegister")}
                </label>
              </div>

              {/* Currency */}
              <div className="relative group">
                <input
                  id="currency"
                  name="currency"
                  type="text"
                  required
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("currency")}
                />
                <label 
                  htmlFor="currency" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("currency")}
                </label>
              </div>

              {/* Specialization */}
              <div className="relative group md:col-span-2">
                <input
                  id="specialization"
                  name="specialization"
                  type="text"
                  required
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("specialization")}
                />
                <label 
                  htmlFor="specialization" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("specialization")}
                </label>
              </div>

              {/* National Address */}
              <div className="relative group md:col-span-2">
                <input
                  id="address"
                  name="address"
                  type="text"
                  required
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("address")}
                />
                <label 
                  htmlFor="address" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("address")}
                </label>
              </div>

              {/* Tax ID */}
              <div className="relative group">
                <input
                  id="taxId"
                  name="taxId"
                  type="text"
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("taxId")}
                />
                <label 
                  htmlFor="taxId" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("taxId")}
                </label>
              </div>

              {/* Employee Count */}
              <div className="relative group">
                <input
                  id="employeeCount"
                  name="employeeCount"
                  type="number"
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("employeeCount")}
                />
                <label 
                  htmlFor="employeeCount" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("employeeCount")}
                </label>
              </div>
            </div>

            <div className="pt-8">
              <button 
                type="submit" 
                className="w-full bg-[#111] text-white dark:bg-white dark:text-[#050505] h-14 flex items-center justify-between px-8 hover:bg-black/80 dark:hover:bg-[#e0e0e0] transition-colors duration-500 group disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isPending}
              >
                <span className="text-sm font-semibold uppercase tracking-widest">
                  {isPending ? t("isPending") : t("submit")}
                </span>
                {!isPending && (
                  <MoveRight className="w-5 h-5 rtl:rotate-180 group-hover:translate-x-2 rtl:group-hover:-translate-x-2 transition-transform duration-500" />
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

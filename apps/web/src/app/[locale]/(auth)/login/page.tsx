"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AuthNav } from "@/components/navigation/auth-nav";
import { useRouter } from "@/i18n/routing";
import { useLogin } from "@/lib/auth/use-auth";

export default function LoginPage() {
  const router = useRouter();
  const { login, isPending, error } = useLogin();
  const t = useTranslations("Auth.login");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const ok = await login(email, password);
    if (ok) router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] dark:bg-[#050505] text-[#111] dark:text-[#e0e0e0] font-sans selection:bg-black/10 dark:selection:bg-white/20 transition-colors duration-500">
      
      <AuthNav />
      
      {/* Right Architectural Image Panel */}
      <div className="hidden lg:block relative w-[55%] xl:w-[60%] overflow-hidden bg-white dark:bg-black">
        <Image
          className="absolute inset-0 h-full w-full object-cover opacity-80 dark:opacity-60 dark:mix-blend-luminosity scale-105"
          src="/images/login-bg.png"
          alt="Premium Architecture"
          fill
          priority
          sizes="60vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#fcfcfc] via-transparent to-[#fcfcfc]/80 dark:from-[#050505] dark:via-transparent dark:to-[#050505]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#fcfcfc] via-transparent to-transparent dark:from-[#050505]" />
        
        <div className="absolute bottom-16 start-16 max-w-lg z-10 text-[#111] dark:text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-4xl font-light tracking-wide mb-4">
              {t("heroTitle")}
            </h1>
            <p className="text-[#555] dark:text-[#a0a0a0] font-light leading-relaxed text-lg">
              {t("heroDesc")}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Left Form Panel */}
      <div className="flex w-full lg:w-[45%] xl:w-[40%] flex-col justify-center px-8 sm:px-16 xl:px-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm mx-auto lg:mx-0"
        >
          {/* Logo / Brand */}
          <Link href="/" className="inline-block mb-16 opacity-80 hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 border border-black/20 dark:border-white/20 flex items-center justify-center relative">
              <div className="w-2 h-2 bg-[#111] dark:bg-white rounded-full"></div>
              <div className="absolute -inset-1 border border-black/5 dark:border-white/5"></div>
            </div>
          </Link>
          
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
            
            <div className="space-y-8">
              {/* Custom Input: Email */}
              <div className="relative group">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("email")}
                />
                <label 
                  htmlFor="email" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("email")}
                </label>
              </div>

              {/* Custom Input: Password */}
              <div className="relative group">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("password")}
                />
                <label 
                  htmlFor="password" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("password")}
                </label>

                <div className="absolute end-0 -top-5">
                  <Link
                    href="/forgot-password"
                    className="text-[10px] uppercase tracking-widest text-[#666] hover:text-[#111] dark:hover:text-white transition-colors duration-300"
                  >
                    {t("forgotPassword")}
                  </Link>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button 
                type="submit" 
                className="w-full bg-[#111] text-white dark:bg-white dark:text-[#050505] h-12 flex items-center justify-between px-6 hover:bg-black/80 dark:hover:bg-[#e0e0e0] transition-colors duration-500 group disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isPending}
              >
                <span className="text-xs font-semibold uppercase tracking-widest">
                  {isPending ? t("isPending") : t("submit")}
                </span>
                {!isPending && (
                  <MoveRight className="w-4 h-4 rtl:rotate-180 group-hover:translate-x-2 rtl:group-hover:-translate-x-2 transition-transform duration-500" />
                )}
              </button>
            </div>
          </form>

          <div className="mt-16 text-xs text-[#666] tracking-wide">
             {t("noAccount")}{" "}
            <Link
              href="/register"
              className="text-[#111] dark:text-white hover:opacity-70 transition-colors uppercase ml-2 border-b border-black/30 dark:border-white/30 pb-1"
            >
              {t("createAccount")}
            </Link>
          </div>
          
          <div className="mt-12 text-[10px] text-[#888] dark:text-[#444] tracking-widest uppercase">
             {t("copyright")}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

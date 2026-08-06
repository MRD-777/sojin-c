"use client";

import { useRouter, Link } from "@/i18n/routing";
import { useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AuthNav } from "@/components/navigation/auth-nav";
import { useAuthStore } from "@/store/use-auth-store";

// Client-side schema mirrors the backend RegisterCompanyDto
// (apps/api/src/modules/auth/dto/index.ts): password min 10 + complexity,
// phone regex. Catches errors before the network round-trip; the backend
// still re-validates (whitelist:true) as the source of truth.
const PASSWORD_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/;
const PHONE_RE = /^[+]?[\d\s\-()]{8,20}$/;

const registerSchema = z.object({
  firstName: z.string().min(2, "required"),
  lastName: z.string().min(2, "required"),
  phone: z
    .string()
    .regex(PHONE_RE, "invalidPhone")
    .optional()
    .or(z.literal("")),
  email: z.string().email("invalidEmail"),
  password: z
    .string()
    .min(10, "weakPassword")
    .max(128, "weakPassword")
    .regex(PASSWORD_COMPLEXITY, "weakPassword"),
});

export default function RegisterPage() {
  const t = useTranslations("Auth.register");
  const tErrors = useTranslations("Auth.errors");
  const router = useRouter();
  const setPendingRegistration = useAuthStore((s) => s.setPendingRegistration);
  const [fields, setFields] = useState<Record<string, string>>({});
  const isPending = false; // navigation only — no async backend call here

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = {
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };

    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFields(
        Object.fromEntries(
          Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ""]),
        ),
      );
      return;
    }

    setFields({});
    // Carry creds in memory only → setup-workspace builds the atomic payload.
    setPendingRegistration({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone ? parsed.data.phone : undefined,
      email: parsed.data.email,
      password: parsed.data.password,
    });
    router.push("/setup-workspace");
  }

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] dark:bg-[#050505] text-[#111] dark:text-[#e0e0e0] font-sans selection:bg-black/10 dark:selection:bg-white/20 transition-colors duration-500">
      
      <AuthNav />

      {/* Right Architectural Image Panel */}
      <div className="hidden lg:block relative w-[45%] xl:w-[50%] overflow-hidden">
        <Image
          className="absolute inset-0 h-full w-full object-cover opacity-80 dark:opacity-60 dark:mix-blend-luminosity scale-105"
          src="/images/register-bg.png"
          alt="Premium Architecture"
          fill
          priority
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-[#fcfcfc] via-transparent to-[#fcfcfc]/80 dark:from-[#050505] dark:via-transparent dark:to-[#050505]/40" />
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
      <div className="flex w-full lg:w-[55%] xl:w-[50%] flex-col justify-center px-8 sm:px-16 xl:px-24 relative z-10 py-12">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg mx-auto lg:mx-0"
        >
          {/* Logo / Brand */}
          <Link href="/" className="inline-block mb-12 opacity-80 hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 border border-black/20 dark:border-white/20 flex items-center justify-center relative">
              <div className="w-2 h-2 bg-[#111] dark:bg-white rounded-full"></div>
              <div className="absolute -inset-1 border border-black/5 dark:border-white/5"></div>
            </div>
          </Link>
          
          <div className="mb-12">
            <h2 className="text-3xl font-light text-[#111] dark:text-white mb-2">{t("title")}</h2>
            <p className="text-[#666] text-sm tracking-wide">{t("subtitle")}</p>
          </div>

          <form className="space-y-10" onSubmit={handleSubmit} noValidate>
            {fields.form && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-s-2 border-[#ef4444] px-4 py-2 text-[#ef4444] text-xs uppercase tracking-wider bg-[#ef4444]/5"
              >
                {tErrors(fields.form)}
              </motion.div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
              {/* First Name */}
              <div className="relative group">
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("firstName")}
                />
                <label 
                  htmlFor="firstName" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("firstName")}
                </label>
                {fields.firstName && (
                  <p className="text-[#ef4444] text-xs mt-2 uppercase tracking-wide">{fields.firstName}</p>
                )}
              </div>

              {/* Last Name */}
              <div className="relative group">
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("lastName")}
                />
                <label 
                  htmlFor="lastName" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("lastName")}
                </label>
                {fields.lastName && (
                  <p className="text-[#ef4444] text-xs mt-2 uppercase tracking-wide">{fields.lastName}</p>
                )}
              </div>

              {/* Phone */}
              <div className="relative group md:col-span-2">
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  className="peer w-full bg-transparent border-0 border-b border-black/20 dark:border-white/20 text-[#111] dark:text-white placeholder-transparent focus:border-[#111] dark:focus:border-white focus:ring-0 px-0 py-2 text-base transition-colors duration-500 outline-none"
                  placeholder={t("phone")}
                />
                <label 
                  htmlFor="phone" 
                  className="absolute start-0 -top-5 text-[#666] text-xs transition-all duration-300 peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#111] dark:peer-focus:text-white pointer-events-none"
                >
                  {t("phone")}
                </label>
                {fields.phone && (
                  <p className="text-[#ef4444] text-xs mt-2 uppercase tracking-wide">{fields.phone}</p>
                )}
              </div>

              {/* Email */}
              <div className="relative group md:col-span-2 mt-4">
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
                {fields.email && (
                  <p className="text-[#ef4444] text-xs mt-2 uppercase tracking-wide">{fields.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="relative group md:col-span-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
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
                {fields.password && (
                  <p className="text-[#ef4444] text-xs mt-2 uppercase tracking-wide">{fields.password}</p>
                )}
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
            
            <p className="text-[10px] text-[#777] dark:text-[#555] leading-relaxed mt-4 w-3/4">
              {t("termsDesc")}
              <Link href="/terms" className="text-[#111] dark:text-white hover:underline transition-all">{t("termsLink")}</Link>
              {t("termsSuffix")}
            </p>
          </form>

          <div className="mt-16 text-xs text-[#666] tracking-wide">
             {t("alreadyHave")}{" "}
            <Link
              href="/login"
              className="text-[#111] dark:text-white hover:opacity-70 transition-colors uppercase ml-2 border-b border-black/30 dark:border-white/30 pb-1"
            >
              {t("backToLogin")}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

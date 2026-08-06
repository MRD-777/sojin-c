import { Building2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md mx-auto space-y-6">
        {/* 404 Visual */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-3xl bg-black/5 dark:bg-white/5 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-black text-[#111] dark:text-white">404</span>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#111] dark:text-white">
            الصفحة غير موجودة
          </h2>
          <p className="text-sm text-[#666] dark:text-[#999] leading-relaxed">
            الصفحة التي تبحث عنها غير موجودة أو تم نقلها. تحقق من الرابط أو عد للوحة التحكم.
          </p>
        </div>

        {/* Action */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#111] text-white dark:bg-white dark:text-[#111] rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg"
        >
          <Building2 className="w-4 h-4" />
          العودة للوحة التحكم
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}

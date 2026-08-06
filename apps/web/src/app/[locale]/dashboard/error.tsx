"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md mx-auto space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#111] dark:text-white">
            حدث خطأ غير متوقع
          </h2>
          <p className="text-sm text-[#666] dark:text-[#999] leading-relaxed">
            نعتذر عن هذا الخطأ. يمكنك إعادة المحاولة أو العودة للصفحة الرئيسية.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-[#999] dark:text-[#666] mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#111] text-white dark:bg-white dark:text-[#111] rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 px-5 py-2.5 border border-black/10 dark:border-white/10 text-[#111] dark:text-white rounded-xl text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Home className="w-4 h-4" />
            لوحة التحكم
          </button>
        </div>
      </div>
    </div>
  );
}

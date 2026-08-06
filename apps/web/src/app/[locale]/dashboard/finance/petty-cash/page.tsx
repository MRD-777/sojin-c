"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  Banknote,
  CheckCircle2,
  AlertCircle,
  Users,
  PieChart,
  UserCheck,
  History
} from "lucide-react";
import { StatCard } from "@/components/dashboard/global/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";

export default function PettyCashPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";
  
  const currency = isAr ? "ج.م" : "EGP";

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto">
      <Breadcrumbs />
      <header className="mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111] dark:text-white flex items-center gap-2">
          <Banknote className="w-6 h-6 sm:w-8 sm:h-8" />
          {t("finance.pettyCash.title")}
        </h1>
        <p className="text-sm text-[#666] dark:text-[#999] mt-2 max-w-2xl text-start">
          {t("finance.pettyCash.subtitle")}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t("finance.pettyCash.kpi.openTotal")}
          value={`100,000 ${currency}`}
          icon={<Banknote className="w-5 h-5" />}
          trend={{ value: 2, isPositive: false, label: t("finance.overview.kpi.increased") }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.pettyCash.kpi.settledThisMonth")}
          value={`40,000 ${currency}`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          trend={{ value: 15, isPositive: true, label: t("finance.overview.kpi.vsLastMonth") }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.pettyCash.kpi.overdue")}
          value={`30,000 ${currency}`}
          icon={<AlertCircle className="w-5 h-5" />}
          trend={{ value: 1, isPositive: false, label: t("finance.pettyCash.kpi.casesOver30Days") || "Case > 30 days" }}
          colorClass="bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
        />
        <StatCard
          title={t("finance.pettyCash.kpi.holdersCount")}
          value="4"
          icon={<Users className="w-5 h-5" />}
          trend={{ value: 0, isPositive: true, label: t("finance.pettyCash.kpi.activeHolders") || "Active holders" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
      </div>

      <hr className="my-8 border-black/5 dark:border-white/5" />

      {/* Main Table */}
      <div className="mt-8">
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5 flex flex-row items-center gap-2">
            <Banknote className="w-5 h-5 text-[#666] dark:text-[#999]" />
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.pettyCash.table.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colId")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colHolder")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colProject")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colOriginalAmount")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colSpent")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colRemaining")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colInvoicesCount")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colIssueDate")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colAge")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                  {[
                    { id: "PC-5092", holder: isAr ? "أحمد علي" : "Ahmed Ali", project: isAr ? "مشروع الرياض 1" : "Riyadh Project 1", amount: `50,000 ${currency}`, spent: `37,500 ${currency}`, remaining: `12,500 ${currency}`, invoices: "12", date: "2024-10-01", age: 14, status: t("finance.pettyCash.table.statusOpen"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
                    { id: "PC-5093", holder: isAr ? "عمر حسن" : "Omar Hassan", project: isAr ? "مجمع جدة" : "Jeddah Complex", amount: `30,000 ${currency}`, spent: `25,000 ${currency}`, remaining: `5,000 ${currency}`, invoices: "8", date: "2024-09-15", age: 35, status: t("finance.pettyCash.table.statusOverdue"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                    { id: "PC-5094", holder: isAr ? "سارة أحمد" : "Sara Ahmed", project: isAr ? "برج الدمام" : "Dammam Tower", amount: `20,000 ${currency}`, spent: `5,000 ${currency}`, remaining: `15,000 ${currency}`, invoices: "3", date: "2024-10-10", age: 5, status: t("finance.pettyCash.table.statusOpen"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
                    { id: "PC-5095", holder: isAr ? "خالد نور" : "Khalid Noor", project: isAr ? "مشروع نيوم" : "Neom Project", amount: `40,000 ${currency}`, spent: `40,000 ${currency}`, remaining: `0 ${currency}`, invoices: "20", date: "2024-08-20", age: 55, status: t("finance.pettyCash.table.statusSettled"), statusClass: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20" },
                    { id: "PC-5096", holder: isAr ? "يوسف كامل" : "Youssef Kamel", project: isAr ? "مستشفى الشفاء الجديد" : "New Shifa Hospital", amount: `25,000 ${currency}`, spent: `10,000 ${currency}`, remaining: `15,000 ${currency}`, invoices: "4", date: "2024-10-05", age: 10, status: t("finance.pettyCash.table.statusOpen"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
                    { id: "PC-5097", holder: isAr ? "طارق سعيد" : "Tarek Saeed", project: isAr ? "مجمع النخلة السكني" : "Palm Residential Complex", amount: `60,000 ${currency}`, spent: `50,000 ${currency}`, remaining: `10,000 ${currency}`, invoices: "18", date: "2024-09-01", age: 45, status: t("finance.pettyCash.table.statusOverdue"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                  ].map((pc, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{pc.id}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{pc.holder}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{pc.project}</td>
                      <td className="px-6 py-4 font-medium text-[#111] dark:text-[#ccc] text-start">{pc.amount}</td>
                      <td className="px-6 py-4 font-medium text-[#666] dark:text-[#999] text-start">{pc.spent}</td>
                      <td className="px-6 py-4 font-bold text-[#111] dark:text-[#ccc] text-start">{pc.remaining}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{pc.invoices}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{pc.date}</td>
                      <td className={`px-6 py-4 font-medium text-start ${pc.age > 30 ? 'text-orange-600 dark:text-orange-400' : 'text-[#666] dark:text-[#999]'}`}>{pc.age} {isAr ? 'يوم' : 'Days'}</td>
                      <td className="px-6 py-4 text-start">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pc.statusClass}`}>
                          {pc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <hr className="my-8 border-black/5 dark:border-white/5" />

      {/* Expense Breakdown & Holder Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5 flex flex-row items-center gap-2">
            <PieChart className="w-5 h-5 text-[#666] dark:text-[#999]" />
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.pettyCash.breakdown.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.breakdown.colCategory")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.breakdown.colAmount")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.breakdown.colInvoicesCount")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.breakdown.colPercentage")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                  {[
                    { cat: t("finance.pettyCash.breakdown.categories.materials"), amount: `65,000 ${currency}`, count: "45", pct: "40%" },
                    { cat: t("finance.pettyCash.breakdown.categories.transport"), amount: `32,500 ${currency}`, count: "80", pct: "20%" },
                    { cat: t("finance.pettyCash.breakdown.categories.food"), amount: `24,375 ${currency}`, count: "120", pct: "15%" },
                    { cat: t("finance.pettyCash.breakdown.categories.tools"), amount: `16,250 ${currency}`, count: "25", pct: "10%" },
                    { cat: t("finance.pettyCash.breakdown.categories.emergency"), amount: `13,000 ${currency}`, count: "5", pct: "8%" },
                    { cat: t("finance.pettyCash.breakdown.categories.misc"), amount: `11,375 ${currency}`, count: "15", pct: "7%" },
                  ].map((item, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{item.cat}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{item.amount}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{item.count}</td>
                      <td className="px-6 py-4 font-bold text-[#111] dark:text-white text-start">{item.pct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5 flex flex-row items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#666] dark:text-[#999]" />
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.pettyCash.holderPerformance.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.holderPerformance.colHolder")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.holderPerformance.colTotalPettyCash")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.holderPerformance.colSettledOnTime")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.holderPerformance.colAvgSettlementDays")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.holderPerformance.colRating")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                  {[
                    { holder: isAr ? "أحمد علي" : "Ahmed Ali", total: 12, onTime: 10, avgDays: "12", rating: t("finance.pettyCash.holderPerformance.ratingExcellent"), ratingClass: "text-green-600 dark:text-green-400" },
                    { holder: isAr ? "سارة أحمد" : "Sara Ahmed", total: 8, onTime: 7, avgDays: "15", rating: t("finance.pettyCash.holderPerformance.ratingGood"), ratingClass: "text-[#666] dark:text-[#999]" },
                    { holder: isAr ? "عمر حسن" : "Omar Hassan", total: 15, onTime: 8, avgDays: "32", rating: t("finance.pettyCash.holderPerformance.ratingNeedsImprovement"), ratingClass: "text-orange-600 dark:text-orange-400" },
                    { holder: isAr ? "خالد نور" : "Khalid Noor", total: 5, onTime: 5, avgDays: "8", rating: t("finance.pettyCash.holderPerformance.ratingExcellent"), ratingClass: "text-green-600 dark:text-green-400" },
                  ].map((item, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{item.holder}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{item.total}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{item.onTime}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{item.avgDays}</td>
                      <td className={`px-6 py-4 font-medium text-start ${item.ratingClass}`}>{item.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <hr className="my-8 border-black/5 dark:border-white/5" />

      {/* Audit Trail */}
      <div className="mt-8">
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5 flex flex-row items-center gap-2">
            <History className="w-5 h-5 text-[#666] dark:text-[#999]" />
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.pettyCash.auditTrail.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.table.colId")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.auditTrail.colDate")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.auditTrail.colAuditor")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.auditTrail.colResult")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.pettyCash.auditTrail.colNotes")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                  {[
                    { id: "PC-5092", date: "2024-10-15 09:30", auditor: isAr ? "سمير عبدالله (مدقق مالي)" : "Samir Abdallah (Auditor)", result: t("finance.pettyCash.auditTrail.results.passed"), resultClass: "text-green-600 dark:text-green-400", notes: isAr ? "جميع الفواتير مطابقة ومسجلة بشكل صحيح." : "All invoices match and are properly recorded." },
                    { id: "PC-5093", date: "2024-10-14 14:20", auditor: isAr ? "سمير عبدالله (مدقق مالي)" : "Samir Abdallah (Auditor)", result: t("finance.pettyCash.auditTrail.results.minorIssues"), resultClass: "text-orange-600 dark:text-orange-400", notes: isAr ? "فاتورة رقم 343 غير واضحة المعالم، تم طلب استبدالها." : "Invoice #343 is unclear, replacement requested." },
                    { id: "PC-5080", date: "2024-09-28 11:00", auditor: isAr ? "سمير عبدالله (مدقق مالي)" : "Samir Abdallah (Auditor)", result: t("finance.pettyCash.auditTrail.results.majorIssues"), resultClass: "text-red-600 dark:text-red-400", notes: isAr ? "تجاوز للصلاحيات في صرف مواد غير معتمدة. قيد التحقيق." : "Exceeded authority by spending on unapproved materials. Under investigation." },
                  ].map((item, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{item.id}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{item.date}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{item.auditor}</td>
                      <td className={`px-6 py-4 font-medium text-start ${item.resultClass}`}>{item.result}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

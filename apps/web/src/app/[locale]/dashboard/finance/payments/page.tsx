"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  CreditCard,
  Clock,
  Calendar,
  AlertTriangle,
  Receipt,
  PieChart,
  ShieldCheck
} from "lucide-react";
import { StatCard } from "@/components/dashboard/global/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";

export default function PaymentsPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";

  const currency = isAr ? "ج.م" : "EGP";

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto">
      <Breadcrumbs />
      <header className="mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111] dark:text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 sm:w-8 sm:h-8" />
          {t("finance.payments.title")}
        </h1>
        <p className="text-sm text-[#666] dark:text-[#999] mt-2 max-w-2xl text-start">
          {t("finance.payments.subtitle")}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t("finance.payments.kpi.totalThisMonth")}
          value={`7.9M ${currency}`}
          icon={<CreditCard className="w-5 h-5" />}
          trend={{ value: 4, isPositive: true, label: t("finance.overview.kpi.vsLastMonth") }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.payments.kpi.pending")}
          value={`6.6M ${currency}`}
          icon={<Clock className="w-5 h-5" />}
          trend={{ value: 12, isPositive: false, label: isAr ? "تحتاج موافقة" : "Needs approval" }}
          colorClass="bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
        />
        <StatCard
          title={t("finance.payments.kpi.scheduled")}
          value={`5.4M ${currency}`}
          icon={<Calendar className="w-5 h-5" />}
          trend={{ value: 0, isPositive: true, label: isAr ? "خلال 30 يوم" : "Next 30 days" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.payments.kpi.overdue")}
          value={`850K ${currency}`}
          icon={<AlertTriangle className="w-5 h-5" />}
          trend={{ value: 3, isPositive: false, label: isAr ? "عاجل" : "Urgent" }}
          colorClass="bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
        />
      </div>

      <hr className="my-8 border-black/5 dark:border-white/5" />

      {/* Main Table & Category Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-black/5 dark:border-white/5 h-full">
            <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5 flex flex-row items-center gap-2">
              <Receipt className="w-5 h-5 text-[#666] dark:text-[#999]" />
              <CardTitle className="text-lg text-[#111] dark:text-white">
                {t("finance.payments.table.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                    <tr>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.payments.table.colId")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.payments.table.colDate")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.payments.table.colBeneficiary")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.payments.table.colProject")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.payments.table.colAmount")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.payments.table.colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                    {[
                      { id: "PAY-1001", date: "2024-10-24", beneficiary: t("finance.payments.table.beneficiaries.alFahd"), project: isAr ? "مشروع الرياض 1" : "Riyadh Project 1", amount: `450,000 ${currency}`, status: t("finance.payments.table.statusCompleted"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
                      { id: "PAY-1002", date: "2024-10-25", beneficiary: t("finance.payments.table.beneficiaries.gulfBuild"), project: isAr ? "مجمع جدة" : "Jeddah Complex", amount: `1.2M ${currency}`, status: t("finance.payments.table.statusPending"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                      { id: "PAY-1003", date: "2024-11-05", beneficiary: t("finance.payments.table.beneficiaries.alFahd"), project: isAr ? "مشروع الرياض 1" : "Riyadh Project 1", amount: `5.4M ${currency}`, status: t("finance.payments.table.statusPending"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                      { id: "PAY-1004", date: "2024-09-15", beneficiary: t("finance.payments.table.beneficiaries.gulfBuild"), project: isAr ? "برج الدمام" : "Dammam Tower", amount: `850,000 ${currency}`, status: t("finance.payments.table.statusCancelled"), statusClass: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20" },
                      { id: "PAY-1005", date: "2024-10-28", beneficiary: isAr ? "شركة الأسمنت الوطنية" : "National Cement Co", project: isAr ? "مشروع الرياض 1" : "Riyadh Project 1", amount: `250,000 ${currency}`, status: t("finance.payments.table.statusCompleted"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
                      { id: "PAY-1006", date: "2024-11-02", beneficiary: isAr ? "مكتب الاستشارات الهندسية" : "Engineering Consultancy Office", project: isAr ? "برج الدمام" : "Dammam Tower", amount: `150,000 ${currency}`, status: t("finance.payments.table.statusPending"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                      { id: "PAY-1007", date: "2024-10-30", beneficiary: isAr ? "شركة تأجير المعدات" : "Equipment Rental Co", project: isAr ? "مجمع جدة" : "Jeddah Complex", amount: `90,000 ${currency}`, status: t("finance.payments.table.statusCompleted"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
                    ].map((pay, i) => (
                      <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{pay.id}</td>
                        <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{pay.date}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{pay.beneficiary}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{pay.project}</td>
                        <td className="px-6 py-4 font-bold text-[#111] dark:text-white text-start">{pay.amount}</td>
                        <td className="px-6 py-4 text-start">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pay.statusClass}`}>
                            {pay.status}
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

        <div className="lg:col-span-1">
          <Card className="border-black/5 dark:border-white/5 h-full">
            <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5 flex flex-row items-center gap-2">
              <PieChart className="w-5 h-5 text-[#666] dark:text-[#999]" />
              <CardTitle className="text-lg text-[#111] dark:text-white">
                {t("finance.payments.categoryAnalysis.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                    <tr>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.payments.categoryAnalysis.colCategory")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.payments.categoryAnalysis.colThisMonth")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.payments.categoryAnalysis.colPercentage")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                    {[
                      { cat: t("finance.payments.categoryAnalysis.categories.materials"), amount: `3.2M`, pct: "40%" },
                      { cat: t("finance.payments.categoryAnalysis.categories.subcontractors"), amount: `2.4M`, pct: "30%" },
                      { cat: t("finance.payments.categoryAnalysis.categories.equipment"), amount: `1.2M`, pct: "15%" },
                      { cat: t("finance.payments.categoryAnalysis.categories.siteSalaries"), amount: `800K`, pct: "10%" },
                      { cat: t("finance.payments.categoryAnalysis.categories.admin"), amount: `400K`, pct: "5%" },
                    ].map((item, i) => (
                      <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{item.cat}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{item.amount} {currency}</td>
                        <td className="px-6 py-4 font-bold text-[#111] dark:text-white text-start">{item.pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <hr className="my-8 border-black/5 dark:border-white/5" />

      {/* Scheduled Payments & Guarantees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5 flex flex-row items-center gap-2">
            <Calendar className="w-5 h-5 text-[#666] dark:text-[#999]" />
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.payments.scheduled.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.payments.scheduled.colDueDate")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.payments.scheduled.colBeneficiary")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.payments.scheduled.colAmount")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.payments.scheduled.colPriority")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                  {[
                    { date: "2024-11-15", ben: t("finance.payments.table.beneficiaries.alFahd"), amount: `1.5M ${currency}`, prio: t("finance.payments.scheduled.priorityHigh"), prioClass: "text-red-600 dark:text-red-400 font-medium" },
                    { date: "2024-11-20", ben: isAr ? "الشركة الوطنية للحديد" : "National Steel Co", amount: `2.0M ${currency}`, prio: t("finance.payments.scheduled.priorityNormal"), prioClass: "text-[#666] dark:text-[#999]" },
                    { date: "2024-11-25", ben: isAr ? "شركة تأجير المعدات" : "Equipment Rental Co", amount: `500K ${currency}`, prio: t("finance.payments.scheduled.priorityNormal"), prioClass: "text-[#666] dark:text-[#999]" },
                  ].map((item, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{item.date}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{item.ben}</td>
                      <td className="px-6 py-4 font-bold text-[#111] dark:text-white text-start">{item.amount}</td>
                      <td className={`px-6 py-4 text-start ${item.prioClass}`}>{item.prio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5 flex flex-row items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#666] dark:text-[#999]" />
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.payments.guarantees.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.payments.guarantees.colType")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.payments.guarantees.colBank")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.payments.guarantees.colValue")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.payments.guarantees.colExpiryDate")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                  {[
                    { type: t("finance.payments.guarantees.types.bidBond"), bank: isAr ? "البنك الأهلي" : "NCB", value: `1.0M ${currency}`, date: "2025-06-30" },
                    { type: t("finance.payments.guarantees.types.performanceBond"), bank: isAr ? "مصرف الراجحي" : "Al Rajhi Bank", value: `5.0M ${currency}`, date: "2026-12-31" },
                    { type: t("finance.payments.guarantees.types.advancePayment"), bank: isAr ? "بنك الرياض" : "Riyad Bank", value: `2.5M ${currency}`, date: "2025-03-15" },
                  ].map((item, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{item.type}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{item.bank}</td>
                      <td className="px-6 py-4 font-bold text-[#111] dark:text-white text-start">{item.value}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{item.date}</td>
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

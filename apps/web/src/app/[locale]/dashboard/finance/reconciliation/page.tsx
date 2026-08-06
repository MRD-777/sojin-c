"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  Building2, 
  Wallet, 
  FileText,
  ArrowRightLeft,
  Briefcase,
  AlertTriangle
} from "lucide-react";
import { StatCard } from "@/components/dashboard/global/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";

export default function ReconciliationPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";
  
  const currency = isAr ? "ج.م" : "EGP";

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto">
      <Breadcrumbs />
      <header className="mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111] dark:text-white flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          {t("finance.reconciliation.title")}
        </h1>
        <p className="text-sm text-[#666] dark:text-[#999] mt-2 max-w-2xl">
          {t("finance.reconciliation.subtitle")}
        </p>
      </header>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t("finance.reconciliation.kpi.dueFromClients")}
          value={`15.5M ${currency}`}
          icon={<Building2 className="w-5 h-5" />}
          trend={{ value: 12, isPositive: true, label: isAr ? "تحصيل جديد" : "New collections" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.reconciliation.kpi.dueToSuppliers")}
          value={`8.2M ${currency}`}
          icon={<Wallet className="w-5 h-5" />}
          trend={{ value: 5, isPositive: false, label: isAr ? "التزامات مستحقة" : "Pending liabilities" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.reconciliation.kpi.netPosition")}
          value={`7.3M ${currency}`}
          icon={<FileText className="w-5 h-5" />}
          trend={{ value: 8, isPositive: true, label: isAr ? "تدفق مالي إيجابي" : "Positive flow" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.reconciliation.kpi.overdueInvoicesCount")}
          value="14"
          icon={<AlertTriangle className="w-5 h-5" />}
          trend={{ value: 2, isPositive: false, label: isAr ? "هذا الأسبوع" : "This week" }}
          colorClass="bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* AR Aging Table */}
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.reconciliation.arAging.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.arAging.colProjectClient")}</th>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.arAging.col0to30")}</th>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.arAging.col31to60")}</th>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.arAging.col61to90")}</th>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.arAging.colOver90")}</th>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.arAging.colTotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                  {[
                    { name: t("dashboardPage.table.p1"), c0to30: "2.0M", c31to60: "1.5M", c61to90: "0.5M", over90: "0M", total: "4.0M" },
                    { name: t("dashboardPage.table.p2"), c0to30: "1.0M", c31to60: "0M", c61to90: "0.2M", over90: "0M", total: "1.2M" },
                    { name: t("dashboardPage.table.p3"), c0to30: "0.5M", c31to60: "0.5M", c61to90: "0.5M", over90: "0.5M", total: "2.0M" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#111] dark:text-white text-start">{row.name}</td>
                      <td className="px-4 py-3 text-[#111] dark:text-[#ccc] text-start">{row.c0to30}</td>
                      <td className="px-4 py-3 text-[#111] dark:text-[#ccc] text-start">{row.c31to60}</td>
                      <td className="px-4 py-3 text-orange-600 dark:text-orange-400 text-start">{row.c61to90}</td>
                      <td className="px-4 py-3 text-red-600 dark:text-red-400 text-start">{row.over90}</td>
                      <td className="px-4 py-3 font-bold text-[#111] dark:text-white text-start">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* AP Aging Table */}
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.reconciliation.apAging.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.apAging.colSupplier")}</th>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.apAging.colCurrent")}</th>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.apAging.col1to30")}</th>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.apAging.col31to60")}</th>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.apAging.colOver90")}</th>
                    <th className="px-4 py-3 font-medium text-start">{t("finance.reconciliation.apAging.colTotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                  {[
                    { name: isAr ? "شركة الفهد" : "Al Fahad Co", current: "0.8M", c1to30: "0.4M", c31to60: "0M", over90: "0M", total: "1.2M" },
                    { name: isAr ? "مقاولات الخليج" : "Gulf Builders", current: "1.5M", c1to30: "0.5M", c31to60: "0.2M", over90: "0M", total: "2.2M" },
                    { name: isAr ? "مصنع الحديد" : "Steel Factory", current: "0.5M", c1to30: "1.0M", c31to60: "0.5M", over90: "0.2M", total: "2.2M" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#111] dark:text-white text-start">{row.name}</td>
                      <td className="px-4 py-3 text-[#111] dark:text-[#ccc] text-start">{row.current}</td>
                      <td className="px-4 py-3 text-[#111] dark:text-[#ccc] text-start">{row.c1to30}</td>
                      <td className="px-4 py-3 text-orange-600 dark:text-orange-400 text-start">{row.c31to60}</td>
                      <td className="px-4 py-3 text-red-600 dark:text-red-400 text-start">{row.over90}</td>
                      <td className="px-4 py-3 font-bold text-[#111] dark:text-white text-start">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 mt-8">
        {/* Retainage Summary */}
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.reconciliation.retainage.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.retainage.colProject")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.retainage.colClientRetainage")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.retainage.colSubcontractorRetainage")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.retainage.colNetRetainage")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.retainage.colExpectedReleaseDate")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                  {[
                    { id: "PRJ-001", name: t("dashboardPage.table.p1"), client: "1.5M", sub: "0.8M", net: "0.7M", date: "2025-12-01" },
                    { id: "PRJ-002", name: t("dashboardPage.table.p2"), client: "2.0M", sub: "1.2M", net: "0.8M", date: "2026-06-15" },
                    { id: "PRJ-003", name: t("dashboardPage.table.p3"), client: "0.5M", sub: "0.2M", net: "0.3M", date: "2025-08-20" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-start">
                        <div className="font-semibold text-[#111] dark:text-white">{row.name}</div>
                        <div className="text-xs text-[#666] dark:text-[#999]">{row.id}</div>
                      </td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium text-start">{row.client} {currency}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium text-start">{row.sub} {currency}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-white font-bold text-start">{row.net} {currency}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{row.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <hr className="my-8 border-black/5 dark:border-white/5" />

      {/* Main Data Table */}
      <div className="mt-8">
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5 flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.reconciliation.table.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.table.colProject")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.table.colApproved")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.table.colCollected")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.table.colRemainingClient")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.table.colPaidSuppliers")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.table.colDueSuppliers")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.table.colNetPosition")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.reconciliation.table.colStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-start">
                  {[
                    { id: "PRJ-001", name: t("dashboardPage.table.p1"), approved: "90M", collected: "85M", remClient: "5M", paidSup: "60M", dueSup: "8M", net: "25M", status: t("finance.reconciliation.table.statusDifference"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                    { id: "PRJ-002", name: t("dashboardPage.table.p2"), approved: "70M", collected: "70M", remClient: "0M", paidSup: "55M", dueSup: "0M", net: "15M", status: t("finance.reconciliation.table.statusMatched"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
                    { id: "PRJ-003", name: t("dashboardPage.table.p3"), approved: "120M", collected: "100M", remClient: "20M", paidSup: "80M", dueSup: "15M", net: "20M", status: t("finance.reconciliation.table.statusDifference"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                    { id: "PRJ-004", name: t("dashboardPage.table.p4") || "Project D", approved: "45M", collected: "45M", remClient: "0M", paidSup: "35M", dueSup: "0M", net: "10M", status: t("finance.reconciliation.table.statusMatched"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
                    { id: "PRJ-005", name: t("dashboardPage.table.p5") || "Project E", approved: "200M", collected: "150M", remClient: "50M", paidSup: "120M", dueSup: "30M", net: "30M", status: t("finance.reconciliation.table.statusDifference"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                    { id: "PRJ-006", name: t("dashboardPage.table.p6") || "Project F", approved: "60M", collected: "60M", remClient: "0M", paidSup: "50M", dueSup: "5M", net: "10M", status: t("finance.reconciliation.table.statusDifference"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                    { id: "PRJ-007", name: t("dashboardPage.table.p7") || "Project G", approved: "80M", collected: "75M", remClient: "5M", paidSup: "60M", dueSup: "2M", net: "15M", status: t("finance.reconciliation.table.statusDifference"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                  ].map((project, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-start">
                         <div className="font-semibold text-[#111] dark:text-white">{project.name}</div>
                         <div className="text-xs text-[#666] dark:text-[#999]">{project.id}</div>
                       </td>
                       <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium text-start">{project.approved} {currency}</td>
                       <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium text-start">{project.collected} {currency}</td>
                       <td className="px-6 py-4 text-orange-600 dark:text-orange-400 font-medium text-start">{project.remClient} {currency}</td>
                       <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium text-start">{project.paidSup} {currency}</td>
                       <td className="px-6 py-4 text-orange-600 dark:text-orange-400 font-medium text-start">{project.dueSup} {currency}</td>
                       <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-bold text-start">{project.net} {currency}</td>
                       <td className="px-6 py-4 text-start">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.statusClass}`}>
                           {project.status}
                         </span>
                       </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-black/[0.03] dark:bg-white/[0.03] font-bold border-t-2 border-black/10 dark:border-white/10">
                    <td className="px-6 py-4 text-start text-[#111] dark:text-white">{t("finance.reconciliation.table.total")}</td>
                    <td className="px-6 py-4 text-[#111] dark:text-white text-start">665M {currency}</td>
                    <td className="px-6 py-4 text-[#111] dark:text-white text-start">585M {currency}</td>
                    <td className="px-6 py-4 text-orange-600 dark:text-orange-400 text-start">80M {currency}</td>
                    <td className="px-6 py-4 text-[#111] dark:text-white text-start">460M {currency}</td>
                    <td className="px-6 py-4 text-orange-600 dark:text-orange-400 text-start">60M {currency}</td>
                    <td className="px-6 py-4 text-[#111] dark:text-white text-start">125M {currency}</td>
                    <td className="px-6 py-4 text-start"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  TrendingUp,
  LineChart,
  BarChart,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CalendarDays,
  Layers
} from "lucide-react";
import { StatCard } from "@/components/dashboard/global/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";

export default function ProfitabilityPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";
  
  const currency = isAr ? "ج.م" : "EGP";

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto">
      <Breadcrumbs />
      <header className="mb-6 sm:mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111] dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />
            {t("finance.profitability.title")}
          </h1>
          <p className="text-sm text-[#666] dark:text-[#999] mt-2 max-w-2xl text-start">
            {t("finance.profitability.subtitle")}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t("finance.profitability.kpi.totalRevenue")}
          value={`245.0M ${currency}`}
          icon={<LineChart className="w-5 h-5" />}
          trend={{ value: 18, isPositive: true, label: isAr ? "عن العام الماضي" : "vs last year" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.profitability.kpi.totalCost")}
          value={`182.5M ${currency}`}
          icon={<BarChart className="w-5 h-5" />}
          trend={{ value: 12, isPositive: false, label: isAr ? "زيادة في التكاليف" : "Increased cost" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.profitability.kpi.netProfit")}
          value={`62.5M ${currency}`}
          icon={<ArrowUpRight className="w-5 h-5" />}
          trend={{ value: 24, isPositive: true, label: isAr ? "عن العام الماضي" : "vs last year" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.profitability.kpi.grossMargin")}
          value="25.5%"
          icon={<TrendingUp className="w-5 h-5" />}
          trend={{ value: 1.5, isPositive: true, label: isAr ? "نقطة مئوية" : "Percentage points" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
      </div>

      <div className="mt-8 space-y-8">
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.profitability.table.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start whitespace-nowrap">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.table.colProject")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.table.colContract")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.table.colPlannedCost")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.table.colActualCost")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.table.colVariance")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.table.colActualProfit")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.table.colMargin")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.table.colStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {[
                    { id: "PRJ-001", name: t("dashboardPage.table.p1"), contract: "120M", planned: "90M", actual: "95M", variance: "-5M", profit: "25M", margin: "20.8%", status: t("finance.profitability.table.statusProfitable"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
                    { id: "PRJ-002", name: t("dashboardPage.table.p2"), contract: "85M", planned: "75M", actual: "88M", variance: "-13M", profit: "-3M", margin: "-3.5%", status: t("finance.profitability.table.statusLoss"), statusClass: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20" },
                    { id: "PRJ-003", name: t("dashboardPage.table.p3"), contract: "40M", planned: "32M", actual: "30M", variance: "+2M", profit: "10M", margin: "25%", status: t("finance.profitability.table.statusProfitable"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
                  ].map((proj, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-start">
                         <div className="font-semibold text-[#111] dark:text-white">{proj.name}</div>
                         <div className="text-xs text-[#666] dark:text-[#999]">{proj.id}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-[#111] dark:text-[#ccc] text-start">{proj.contract} {currency}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{proj.planned} {currency}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{proj.actual} {currency}</td>
                      <td className={`px-6 py-4 font-medium text-start ${proj.variance.startsWith('-') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {proj.variance} {currency}
                      </td>
                      <td className={`px-6 py-4 font-bold text-start ${proj.profit.startsWith('-') ? 'text-red-600 dark:text-red-400' : 'text-[#111] dark:text-white'}`}>
                        {proj.profit} {currency}
                      </td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{proj.margin}</td>
                      <td className="px-6 py-4 text-start">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${proj.statusClass}`}>
                          {proj.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-black/5 dark:border-white/5">
            <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
              <CardTitle className="text-lg text-[#111] dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5" />
                {t("finance.profitability.jobCost.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start whitespace-nowrap">
                  <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                    <tr>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.jobCost.colCategory")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.jobCost.colPlanned")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.jobCost.colActual")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.jobCost.colVariance")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {[
                      { category: t("finance.profitability.jobCost.categories.materials"), planned: "45.0M", actual: "48.2M", variance: "-3.2M", varianceClass: "text-red-600 dark:text-red-400" },
                      { category: t("finance.profitability.jobCost.categories.labor"), planned: "35.0M", actual: "33.5M", variance: "+1.5M", varianceClass: "text-green-600 dark:text-green-400" },
                      { category: t("finance.profitability.jobCost.categories.equipment"), planned: "15.0M", actual: "16.1M", variance: "-1.1M", varianceClass: "text-red-600 dark:text-red-400" },
                      { category: t("finance.profitability.jobCost.categories.subcontractors"), planned: "65.0M", actual: "63.0M", variance: "+2.0M", varianceClass: "text-green-600 dark:text-green-400" },
                      { category: t("finance.profitability.jobCost.categories.overhead"), planned: "12.0M", actual: "13.5M", variance: "-1.5M", varianceClass: "text-red-600 dark:text-red-400" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{row.category}</td>
                        <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{row.planned} {currency}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{row.actual} {currency}</td>
                        <td className={`px-6 py-4 font-medium text-start ${row.varianceClass}`}>{row.variance} {currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-black/5 dark:border-white/5">
            <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
              <CardTitle className="text-lg text-[#111] dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                {t("finance.profitability.quarterly.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start whitespace-nowrap">
                  <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                    <tr>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.quarterly.colQuarter")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.quarterly.colRevenue")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.quarterly.colCosts")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.quarterly.colGrossProfit")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.quarterly.colMargin")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {[
                      { quarter: "Q4 2024", revenue: "65.5M", costs: "48.2M", profit: "17.3M", margin: "26.4%", isCurrent: true },
                      { quarter: "Q3 2024", revenue: "58.2M", costs: "44.5M", profit: "13.7M", margin: "23.5%", isCurrent: false },
                      { quarter: "Q2 2024", revenue: "62.0M", costs: "45.8M", profit: "16.2M", margin: "26.1%", isCurrent: false },
                      { quarter: "Q1 2024", revenue: "59.3M", costs: "44.0M", profit: "15.3M", margin: "25.8%", isCurrent: false },
                    ].map((row, i) => (
                      <tr key={i} className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors ${row.isCurrent ? 'bg-black/[0.02] dark:bg-white/[0.02]' : ''}`}>
                        <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">
                          {row.quarter}
                          {row.isCurrent && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/10">{t("finance.profitability.quarterly.current")}</span>}
                        </td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{row.revenue} {currency}</td>
                        <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{row.costs} {currency}</td>
                        <td className="px-6 py-4 font-medium text-green-600 dark:text-green-400 text-start">{row.profit} {currency}</td>
                        <td className="px-6 py-4 font-bold text-[#111] dark:text-white text-start">{row.margin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-red-500/20 dark:border-red-500/20 bg-red-50/30 dark:bg-red-500/5">
          <CardHeader className="pb-4 border-b border-red-500/10 dark:border-red-500/10">
            <CardTitle className="text-lg text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t("finance.profitability.alerts.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start whitespace-nowrap">
                <thead className="bg-red-50/50 dark:bg-red-500/10 border-b border-red-500/10 dark:border-red-500/10 text-red-700 dark:text-red-400">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.table.colProject")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.alerts.colType")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.alerts.colImpact")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.profitability.alerts.colAction")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-500/10 dark:divide-red-500/10">
                  {[
                    { project: "PRJ-002", name: t("dashboardPage.table.p2"), type: t("finance.profitability.alerts.materialOverrun"), impact: "-3.2M", action: t("finance.profitability.alerts.reviewContracts") },
                    { project: "PRJ-004", name: t("dashboardPage.table.p3"), type: t("finance.profitability.alerts.collectionDelay"), impact: t("finance.profitability.alerts.cashFlowRisk"), action: t("finance.profitability.alerts.followUp") },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                      <td className="px-6 py-4 font-medium text-red-900 dark:text-red-200 text-start">{row.project} - {row.name}</td>
                      <td className="px-6 py-4 text-red-700 dark:text-red-300 text-start">{row.type}</td>
                      <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400 text-start">{row.impact} {row.impact.includes('M') ? currency : ''}</td>
                      <td className="px-6 py-4 text-red-700 dark:text-red-300 text-start">{row.action}</td>
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

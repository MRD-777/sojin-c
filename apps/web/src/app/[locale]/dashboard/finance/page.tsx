"use client";

import { useTranslations, useLocale } from "next-intl";
import dynamic from "next/dynamic";
import { 
  Building2, 
  Wallet, 
  AlertCircle, 
  TrendingUp, 
  FileText, 
  Banknote,
  CheckCircle2,
  Clock,
  Calculator,
  Percent,
  Receipt,
  HelpCircle
} from "lucide-react";
import { StatCard } from "@/components/dashboard/global/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";

const ChartSkeleton = () => (
  <div className="h-[350px] w-full animate-pulse bg-black/5 dark:bg-white/5 rounded-xl" />
);

const MonthlyCashFlowChart = dynamic(
  () => import("@/components/dashboard/finance-charts").then(mod => mod.MonthlyCashFlowChart),
  { ssr: false, loading: ChartSkeleton }
);

const ExpensesByCategoryChart = dynamic(
  () => import("@/components/dashboard/finance-charts").then(mod => mod.ExpensesByCategoryChart),
  { ssr: false, loading: ChartSkeleton }
);

export default function FinanceOverviewPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";

  // Data for the 8 KPIs
  const kpis = [
    {
      title: t("finance.overview.kpi.totalActiveContracts"),
      value: "245.0M EGP",
      icon: <Building2 className="w-5 h-5" />,
      trend: { value: 12, isPositive: true, label: t("finance.overview.kpi.vsLastMonth") },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("finance.overview.kpi.totalActualSpent"),
      value: "183.0M EGP",
      icon: <Wallet className="w-5 h-5" />,
      trend: { value: 74, isPositive: true, label: "%" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("finance.overview.kpi.totalApprovedInvoices"),
      value: "172.0M EGP",
      icon: <FileText className="w-5 h-5" />,
      trend: { value: 8, isPositive: true, label: t("finance.overview.kpi.vsLastMonth") },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("finance.overview.kpi.expectedNetProfit"),
      value: "34.5M EGP",
      icon: <TrendingUp className="w-5 h-5" />,
      trend: { value: 14.1, isPositive: true, label: "%" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("finance.overview.kpi.openPettyCash"),
      value: "1.25M EGP",
      icon: <Banknote className="w-5 h-5" />,
      trend: { value: 7, isPositive: false, label: t("finance.overview.kpi.increased") },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("finance.overview.kpi.pendingInvoices"),
      value: "4.3M EGP",
      icon: <AlertCircle className="w-5 h-5" />,
      trend: { value: 5, isPositive: false, label: t("finance.overview.kpi.increased") },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("finance.overview.kpi.collectionRate"),
      value: "92%",
      icon: <Calculator className="w-5 h-5" />,
      trend: { value: 2, isPositive: true, label: t("finance.overview.kpi.vsLastMonth") },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("finance.overview.kpi.vatDue"),
      value: "1.8M EGP",
      icon: <Percent className="w-5 h-5" />,
      trend: { value: 0, isPositive: true, label: "" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    }
  ];

  // 7 Projects data
  const projects = [
    { id: "PRJ-001", name: isAr ? "برج العاصمة" : "Capital Tower", contract: "120M EGP", spent: "95M EGP", invoices: "90M EGP", remaining: "25M EGP", eac: "115M EGP", retainage: "6M EGP", progress: 79, margin: "14%", status: t("finance.overview.table.statusHealthy"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
    { id: "PRJ-002", name: isAr ? "مجمع الأعمال" : "Business Park", contract: "85M EGP", spent: "78M EGP", invoices: "70M EGP", remaining: "7M EGP", eac: "88M EGP", retainage: "4.25M EGP", progress: 91, margin: "8%", status: t("finance.overview.table.statusWarning"), statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
    { id: "PRJ-003", name: isAr ? "المستشفى المركزي" : "Central Hospital", contract: "200M EGP", spent: "45M EGP", invoices: "50M EGP", remaining: "155M EGP", eac: "195M EGP", retainage: "10M EGP", progress: 25, margin: "18%", status: t("finance.overview.table.statusHealthy"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
    { id: "PRJ-004", name: isAr ? "طريق الملك سلمان" : "King Salman Road", contract: "350M EGP", spent: "310M EGP", invoices: "320M EGP", remaining: "40M EGP", eac: "340M EGP", retainage: "17.5M EGP", progress: 88, margin: "12%", status: t("finance.overview.table.statusHealthy"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
    { id: "PRJ-005", name: isAr ? "تطوير الميناء" : "Port Development", contract: "150M EGP", spent: "120M EGP", invoices: "105M EGP", remaining: "30M EGP", eac: "160M EGP", retainage: "7.5M EGP", progress: 80, margin: "-6%", status: t("finance.overview.table.statusWarning"), statusClass: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20" },
    { id: "PRJ-006", name: isAr ? "مترو الأنفاق الخط 4" : "Metro Line 4", contract: "800M EGP", spent: "200M EGP", invoices: "210M EGP", remaining: "600M EGP", eac: "790M EGP", retainage: "40M EGP", progress: 25, margin: "15%", status: t("finance.overview.table.statusHealthy"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
    { id: "PRJ-007", name: isAr ? "المدينة الرياضية" : "Sports City", contract: "450M EGP", spent: "400M EGP", invoices: "420M EGP", remaining: "50M EGP", eac: "445M EGP", retainage: "22.5M EGP", progress: 89, margin: "10%", status: t("finance.overview.table.statusHealthy"), statusClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white" },
  ];

  // Work In Progress (WIP) Summary
  const wipData = [
    { id: "PRJ-001", name: isAr ? "برج العاصمة" : "Capital Tower", contract: "120M EGP", completion: "79%", earned: "94.8M EGP", billed: "90M EGP", overUnder: "4.8M EGP", isOver: false },
    { id: "PRJ-005", name: isAr ? "تطوير الميناء" : "Port Development", contract: "150M EGP", completion: "80%", earned: "120M EGP", billed: "105M EGP", overUnder: "15M EGP", isOver: false },
    { id: "PRJ-006", name: isAr ? "مترو الأنفاق الخط 4" : "Metro Line 4", contract: "800M EGP", completion: "25%", earned: "200M EGP", billed: "210M EGP", overUnder: "-10M EGP", isOver: true },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto">
      <Breadcrumbs />
      <header className="mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111] dark:text-white">
          {t("finance.overview.title")}
        </h1>
        <p className="text-sm text-[#666] dark:text-[#999] mt-2 max-w-2xl">
          {t("finance.overview.subtitle")}
        </p>
      </header>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => (
          <StatCard key={index} {...kpi} />
        ))}
      </div>

      {/* Main Content Area - Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
        {/* Cash Flow Chart */}
        <Card className="border-black/5 dark:border-white/5 h-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.overview.charts.monthlyCashFlow")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyCashFlowChart />
          </CardContent>
        </Card>

        {/* Expenses By Category Chart */}
        <Card className="border-black/5 dark:border-white/5 h-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.overview.charts.expensesByCategory")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExpensesByCategoryChart />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area - Row 2: Projects Overview Table */}
      <div className="mt-8">
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[#111] dark:text-white">
                {t("finance.overview.table.title")}
              </CardTitle>
              <button className="text-sm font-medium text-[#111] dark:text-white hover:underline">
                {isAr ? "عرض الكل" : "View All"} &rarr;
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.overview.table.colProject")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.overview.table.colContractValue")}</th>
                    <th className="px-6 py-4 font-medium text-start">
                      <div className="flex items-center gap-1.5">
                        {t("finance.overview.table.colActualSpent")}
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3.5 h-3.5 text-black/40 dark:text-white/40" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{isAr ? "إجمالي المصروفات الفعلية على المشروع حتى اليوم." : "Total actual expenses on the project to date."}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </th>
                    <th className="px-6 py-4 font-medium text-start">
                      <div className="flex items-center gap-1.5">
                        {t("finance.overview.table.colEAC")}
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3.5 h-3.5 text-black/40 dark:text-white/40" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{isAr ? "التكلفة المقدرة عند الاكتمال (Estimate At Completion) بناءً على الأداء الحالي." : "Estimate At Completion based on current performance."}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.overview.table.colApprovedInvoices")}</th>
                    <th className="px-6 py-4 font-medium text-start">
                      <div className="flex items-center gap-1.5">
                        {t("finance.overview.table.colRetainage")}
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3.5 h-3.5 text-black/40 dark:text-white/40" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{isAr ? "المبالغ المحتجزة كضمان للأعمال حتى الاستلام الابتدائي/النهائي." : "Amounts retained as business guarantee until preliminary/final delivery."}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.overview.table.colRemainingBudget")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.overview.table.colConsumptionRate")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.overview.table.colProfitMargin")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.overview.table.colStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {projects.map((project, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                         <div className="font-semibold text-[#111] dark:text-white">{project.name}</div>
                         <div className="text-xs text-[#666] dark:text-[#999]">{project.id}</div>
                       </td>
                       <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium whitespace-nowrap">{project.contract}</td>
                       <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium whitespace-nowrap">{project.spent}</td>
                       <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium whitespace-nowrap">{project.eac}</td>
                       <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium whitespace-nowrap">{project.invoices}</td>
                       <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium whitespace-nowrap">{project.retainage}</td>
                       <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium whitespace-nowrap">{project.remaining}</td>
                       <td className="px-6 py-4 min-w-[120px]">
                         <div className="flex items-center gap-3">
                           <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden max-w-[80px]">
                             <div className="bg-[#111] dark:bg-white h-full rounded-full" style={{ width: `${project.progress}%` }}></div>
                           </div>
                           <span className="text-[#111] dark:text-[#ccc] font-medium">{project.progress}%</span>
                         </div>
                       </td>
                       <td className={`px-6 py-4 font-medium whitespace-nowrap ${project.margin.startsWith("-") ? "text-red-600 dark:text-red-400" : "text-[#111] dark:text-[#ccc]"}`}>{project.margin}</td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.statusClass}`}>
                           {project.status}
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

      {/* Row 3: WIP Summary & VAT Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* WIP Summary */}
        <Card className="border-black/5 dark:border-white/5 overflow-hidden">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
            <CardTitle className="text-lg text-[#111] dark:text-white">
              {t("finance.overview.wipSummary.title")}
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                <tr>
                  <th className="px-4 py-3 font-medium text-start">{t("finance.overview.wipSummary.colProject")}</th>
                  <th className="px-4 py-3 font-medium text-start">{t("finance.overview.wipSummary.colCompletion")}</th>
                  <th className="px-4 py-3 font-medium text-start">
                    <div className="flex items-center gap-1.5">
                      {t("finance.overview.wipSummary.colEarnedRevenue")}
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-3.5 h-3.5 text-black/40 dark:text-white/40" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{isAr ? "الإيرادات المكتسبة بناءً على نسبة الإنجاز الفعلية (قيمة العقد × نسبة الإنجاز)." : "Earned revenue based on actual percentage of completion (Contract Value × % Complete)."}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="px-4 py-3 font-medium text-start">{t("finance.overview.wipSummary.colBilledToDate")}</th>
                  <th className="px-4 py-3 font-medium text-start">
                    <div className="flex items-center gap-1.5">
                      {t("finance.overview.wipSummary.colOverUnderBilling")}
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-3.5 h-3.5 text-black/40 dark:text-white/40" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{isAr ? "الفرق بين ما تم فوترته للعميل والإيراد المكتسب فعلياً." : "Difference between amounts billed to the client and actual earned revenue."}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {wipData.map((row, i) => (
                  <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium text-[#111] dark:text-white whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-3 text-[#111] dark:text-[#ccc] whitespace-nowrap">{row.completion}</td>
                    <td className="px-4 py-3 text-[#111] dark:text-[#ccc] whitespace-nowrap">{row.earned}</td>
                    <td className="px-4 py-3 text-[#111] dark:text-[#ccc] whitespace-nowrap">{row.billed}</td>
                    <td className={`px-4 py-3 font-medium whitespace-nowrap ${row.isOver ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                      {row.overUnder}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* VAT Summary & Cash Flow Forecast */}
        <div className="space-y-8 flex flex-col">
          {/* VAT Summary */}
          <Card className="border-black/5 dark:border-white/5">
            <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
              <CardTitle className="text-lg text-[#111] dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#666] dark:text-[#999]" />
                {t("finance.overview.vatSummary.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#fafafa] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-4">
                  <p className="text-sm text-[#666] dark:text-[#999] mb-1">{t("finance.overview.vatSummary.outputVat")}</p>
                  <p className="text-xl font-semibold text-[#111] dark:text-white">12.5M EGP</p>
                </div>
                <div className="bg-[#fafafa] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-4">
                  <p className="text-sm text-[#666] dark:text-[#999] mb-1">{t("finance.overview.vatSummary.inputVat")}</p>
                  <p className="text-xl font-semibold text-[#111] dark:text-white">10.7M EGP</p>
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center bg-[#111] dark:bg-white text-white dark:text-[#111] p-4 rounded-xl">
                <div>
                  <p className="text-sm opacity-80 mb-1">{t("finance.overview.vatSummary.netVatDue")}</p>
                  <p className="text-xl font-bold">1.8M EGP</p>
                </div>
                <div className="text-end">
                  <p className="text-sm opacity-80 mb-1">{t("finance.overview.vatSummary.nextReturnDate")}</p>
                  <p className="text-base font-semibold">2024-12-15</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Flow Forecast */}
          <Card className="border-black/5 dark:border-white/5 flex-1">
            <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
              <CardTitle className="text-lg text-[#111] dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#666] dark:text-[#999]" />
                {t("finance.overview.cashFlow.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 flex items-center justify-center">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-[#111] dark:text-white">{t("finance.overview.cashFlow.expectedCollections")}</p>
                    <p className="text-xs text-[#666] dark:text-[#999]">30 {isAr ? "يوم" : "Days"}</p>
                  </div>
                </div>
                <p className="font-semibold text-[#111] dark:text-white">+ 14.5M EGP</p>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-[#111] dark:text-white">{t("finance.overview.cashFlow.scheduledPayments")}</p>
                    <p className="text-xs text-[#666] dark:text-[#999]">30 {isAr ? "يوم" : "Days"}</p>
                  </div>
                </div>
                <p className="font-semibold text-[#111] dark:text-white">- 9.2M EGP</p>
              </div>
              <div className="flex justify-between items-center pt-2">
                <p className="font-semibold text-[#111] dark:text-white">{t("finance.overview.cashFlow.netCashFlow")}</p>
                <p className="font-bold text-lg text-green-600 dark:text-green-400">+ 5.3M EGP</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 4: Urgent Alerts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        
        {/* Urgent Alerts */}
        <div>
          <Card className="border-black/5 dark:border-white/5 bg-[#fafafa] dark:bg-white/[0.02] h-full">
            <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
              <CardTitle className="text-[#111] dark:text-white flex items-center gap-2 text-lg">
                <AlertCircle className="w-5 h-5 text-red-500" />
                {t("finance.overview.alerts.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ul className="space-y-4">
                <li className="flex gap-3 text-sm p-3 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10">
                  <span className="text-red-700 dark:text-red-400 font-medium">
                    {isAr ? "🔴 انحراف في التكلفة بنسبة 15% في مشروع تطوير الميناء." : "🔴 15% cost variance on Port Development project."}
                  </span>
                </li>
                <li className="flex gap-3 text-sm p-3 rounded-lg border border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/10">
                  <span className="text-orange-700 dark:text-orange-400 font-medium">
                    {isAr ? "🟡 تأخر تحصيل دفعة بقيمة 5M من مشروع مجمع الأعمال." : "🟡 Collection delayed for 5M payment from Business Park project."}
                  </span>
                </li>
                <li className="flex gap-3 text-sm p-3 rounded-lg border border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/10">
                  <span className="text-orange-700 dark:text-orange-400 font-medium">
                    {isAr ? "🟡 5 فواتير موردين مستحقة خلال 7 أيام (الإجمالي: 4.3M)." : "🟡 5 supplier invoices due in 7 days (Total: 4.3M)."}
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <div className="h-full">
          <Card className="h-full flex flex-col border-black/5 dark:border-white/5">
            <CardHeader className="pb-4 shrink-0 border-b border-black/5 dark:border-white/5">
              <CardTitle className="text-lg flex items-center gap-2 text-[#111] dark:text-white">
                <Clock className="w-5 h-5 text-[#666] dark:text-[#999]" />
                {t("finance.overview.activity.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="space-y-4">
                {[
                  { id: 1, title: isAr ? "اعتماد مستخلص #INV-2024" : "Invoice #INV-2024 Approved", desc: isAr ? "لمشروع برج العاصمة. القيمة: 1.2M" : "For Capital Tower project. Amount: 1.2M", time: isAr ? "منذ ساعتين" : "2h ago" },
                  { id: 2, title: isAr ? "تصفية عهدة مالية" : "Petty Cash Settled", desc: isAr ? "تمت التصفية بواسطة أحمد علي (مهندس موقع)" : "Settled by Ahmed Ali (Site Eng)", time: isAr ? "منذ 5 ساعات" : "5h ago" },
                  { id: 3, title: isAr ? "صرف دفعة لمقاول باطن" : "Subcontractor Payment Made", desc: isAr ? "لشركة الفهد. القيمة: 450k" : "To Al-Fahd Co. Amount: 450k", time: isAr ? "منذ يوم" : "1d ago" },
                  { id: 4, title: isAr ? "تسجيل ضريبة مستحقة" : "VAT Recorded", desc: isAr ? "بناءً على فواتير المشتريات الأخيرة." : "Based on recent purchase invoices.", time: isAr ? "منذ يومين" : "2d ago" },
                ].map((task) => (
                  <div key={task.id} className="flex justify-between items-center p-3 rounded-lg border border-black/5 dark:border-white/5 bg-[#fafafa] dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#111] dark:text-white">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#111] dark:text-white">{task.title}</p>
                        <p className="text-xs text-[#666] dark:text-[#999] mt-0.5">{task.desc}</p>
                      </div>
                    </div>
                    <span className="text-xs text-[#666] dark:text-[#999] whitespace-nowrap ms-4">{task.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
    </div>
  );
}

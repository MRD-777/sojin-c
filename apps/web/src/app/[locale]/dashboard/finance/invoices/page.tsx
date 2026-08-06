"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  CalendarDays,
  FileSearch,
  Percent
} from "lucide-react";
import { StatCard } from "@/components/dashboard/global/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";

export default function InvoicesPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";
  
  const currency = isAr ? "ج.م" : "EGP";

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto">
      <Breadcrumbs />
      <header className="mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111] dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6 sm:w-8 sm:h-8" />
          {t("finance.invoices.title")}
        </h1>
        <p className="text-sm text-[#666] dark:text-[#999] mt-2 max-w-2xl text-start">
          {t("finance.invoices.subtitle")}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard
          title={t("finance.invoices.kpi.totalIssued")}
          value={`142.5M ${currency}`}
          icon={<FileText className="w-5 h-5" />}
          trend={{ value: 5, isPositive: true, label: isAr ? "عن الشهر السابق" : "vs last month" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.invoices.kpi.approved")}
          value={`95.2M ${currency}`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          trend={{ value: 8, isPositive: true, label: isAr ? "عن الشهر السابق" : "vs last month" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.invoices.kpi.underReview")}
          value={`12.3M ${currency}`}
          icon={<Clock className="w-5 h-5" />}
          trend={{ value: 0, isPositive: true, label: isAr ? "قيد المراجعة" : "Under processing" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.invoices.kpi.collected")}
          value={`85.0M ${currency}`}
          icon={<TrendingUp className="w-5 h-5" />}
          trend={{ value: 12, isPositive: true, label: isAr ? "عن الشهر السابق" : "vs last month" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.invoices.kpi.collectionRate")}
          value="89%"
          icon={<Percent className="w-5 h-5" />}
          trend={{ value: 2, isPositive: true, label: isAr ? "عن الربع الماضي" : "vs last quarter" }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("finance.invoices.kpi.avgCollectionDays")}
          value="42"
          icon={<CalendarDays className="w-5 h-5" />}
          trend={{ value: 5, isPositive: false, label: isAr ? "أيام" : "days" }}
          colorClass="bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
        />
      </div>

      <div className="mt-8 space-y-8">
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
            <CardTitle className="text-lg text-[#111] dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t("finance.invoices.table.title") || "Invoices Log"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start whitespace-nowrap">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.table.colId")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.table.colProject")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.table.colPeriod")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.table.colTotal")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.table.colAdvanceDeduction")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.table.colRetentionDeduction")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.table.colVat")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.table.colNetDue")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.table.colStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {[
                    { id: "INV-2024-05", project: "PRJ-001 - New Cairo Complex", period: "Oct 2024", total: "2,500,000", adv: "250,000", ret: "125,000", vat: "297,500", net: "2,422,500", status: t("finance.invoices.table.statusUnderReview") || "Under Review", statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" },
                    { id: "INV-2024-04", project: "PRJ-001 - New Cairo Complex", period: "Sep 2024", total: "1,800,000", adv: "180,000", ret: "90,000", vat: "214,200", net: "1,744,200", status: t("finance.invoices.table.statusApproved") || "Approved", statusClass: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20" },
                    { id: "INV-2024-03", project: "PRJ-002 - Alex Road", period: "Aug 2024", total: "4,200,000", adv: "420,000", ret: "210,000", vat: "499,800", net: "4,069,800", status: t("finance.invoices.table.statusCollected") || "Collected", statusClass: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20" },
                    { id: "INV-2024-02", project: "PRJ-003 - Giza Tower", period: "Jul 2024", total: "850,000", adv: "85,000", ret: "42,500", vat: "101,150", net: "823,650", status: t("finance.invoices.table.statusRejected") || "Rejected", statusClass: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20" },
                    { id: "INV-2024-01", project: "PRJ-001 - New Cairo Complex", period: "Jun 2024", total: "3,100,000", adv: "310,000", ret: "155,000", vat: "368,900", net: "3,003,900", status: t("finance.invoices.table.statusCollected") || "Collected", statusClass: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20" },
                    { id: "INV-2023-12", project: "PRJ-004 - Sphinx Plaza", period: "May 2024", total: "1,200,000", adv: "120,000", ret: "60,000", vat: "142,800", net: "1,162,800", status: t("finance.invoices.table.statusDraft") || "Draft", statusClass: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700" },
                    { id: "INV-2023-11", project: "PRJ-002 - Alex Road", period: "Apr 2024", total: "5,500,000", adv: "550,000", ret: "275,000", vat: "654,500", net: "5,329,500", status: t("finance.invoices.table.statusSubmitted") || "Submitted", statusClass: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20" },
                    { id: "INV-2023-10", project: "PRJ-003 - Giza Tower", period: "Mar 2024", total: "950,000", adv: "95,000", ret: "47,500", vat: "113,050", net: "920,550", status: t("finance.invoices.table.statusCollected") || "Collected", statusClass: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20" },
                  ].map((inv, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{inv.id}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{inv.project}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{inv.period}</td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{inv.total}</td>
                      <td className="px-6 py-4 text-red-600 dark:text-red-400 text-start">({inv.adv})</td>
                      <td className="px-6 py-4 text-orange-600 dark:text-orange-400 text-start">({inv.ret})</td>
                      <td className="px-6 py-4 text-blue-600 dark:text-blue-400 text-start">+{inv.vat}</td>
                      <td className="px-6 py-4 font-bold text-[#111] dark:text-white text-start">{inv.net} {currency}</td>
                      <td className="px-6 py-4 text-start">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${inv.statusClass}`}>
                          {inv.status}
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
                <TrendingUp className="w-5 h-5" />
                {t("finance.invoices.collectionAnalysis.title") || "Collection Analysis"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start whitespace-nowrap">
                  <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                    <tr>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.collectionAnalysis.colProject")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.collectionAnalysis.colTotalApproved")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.collectionAnalysis.colCollected")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.collectionAnalysis.colOverdue")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.collectionAnalysis.colDSO")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {[
                      { project: "PRJ-001", total: "15.2M", collected: "12.5M", overdue: "2.7M", dso: "38 days", overdueClass: "text-red-600 dark:text-red-400 font-medium" },
                      { project: "PRJ-002", total: "8.4M", collected: "8.4M", overdue: "0", dso: "24 days", overdueClass: "text-[#666] dark:text-[#999]" },
                      { project: "PRJ-003", total: "11.1M", collected: "9.5M", overdue: "1.6M", dso: "45 days", overdueClass: "text-orange-600 dark:text-orange-400 font-medium" },
                      { project: "PRJ-004", total: "22.5M", collected: "18.0M", overdue: "4.5M", dso: "62 days", overdueClass: "text-red-600 dark:text-red-400 font-bold" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{row.project}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{row.total} {currency}</td>
                        <td className="px-6 py-4 text-green-600 dark:text-green-400 text-start">{row.collected} {currency}</td>
                        <td className={`px-6 py-4 text-start ${row.overdueClass}`}>{row.overdue} {row.overdue !== "0" && currency}</td>
                        <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{row.dso}</td>
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
                <FileSearch className="w-5 h-5" />
                {t("finance.invoices.changeOrders.title") || "Change Orders Log"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start whitespace-nowrap">
                  <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                    <tr>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.changeOrders.colId")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.changeOrders.colProject")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.changeOrders.colOriginalValue")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.changeOrders.colChangeValue")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.changeOrders.colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {[
                      { id: "VO-001", project: "PRJ-001", orig: "45.0M", change: "+2.5M", status: t("finance.invoices.changeOrders.statusApproved") || "Approved", statusClass: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
                      { id: "VO-002", project: "PRJ-001", orig: "47.5M", change: "+1.2M", status: t("finance.invoices.changeOrders.statusPending") || "Pending", statusClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
                      { id: "VO-003", project: "PRJ-002", orig: "18.0M", change: "+850K", status: t("finance.invoices.changeOrders.statusApproved") || "Approved", statusClass: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
                      { id: "VO-004", project: "PRJ-003", orig: "32.0M", change: "+3.4M", status: t("finance.invoices.changeOrders.statusRejected") || "Rejected", statusClass: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{row.id}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc] text-start">{row.project}</td>
                        <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{row.orig}</td>
                        <td className="px-6 py-4 font-medium text-green-600 dark:text-green-400 text-start">{row.change}</td>
                        <td className="px-6 py-4 text-start">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.statusClass}`}>
                            {row.status}
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

        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
            <CardTitle className="text-lg text-[#111] dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t("finance.invoices.invoiceRetainage.title") || "Invoices Retainage Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start whitespace-nowrap">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.invoiceRetainage.colProject")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.invoiceRetainage.colRetentionPercentage")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.invoiceRetainage.colTotalRetained")}</th>
                    <th className="px-6 py-4 font-medium text-start">{t("finance.invoices.invoiceRetainage.colExpectedReleaseDate")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {[
                    { project: "PRJ-001 - New Cairo Complex", perc: "5%", retained: "2,250,000", date: "Dec 2025" },
                    { project: "PRJ-002 - Alex Road", perc: "10%", retained: "1,800,000", date: "Mar 2025" },
                    { project: "PRJ-003 - Giza Tower", perc: "5%", retained: "1,600,000", date: "Aug 2026" },
                    { project: "PRJ-004 - Sphinx Plaza", perc: "5%", retained: "1,125,000", date: "Sep 2025" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#111] dark:text-white text-start">{row.project}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{row.perc}</td>
                      <td className="px-6 py-4 font-bold text-[#111] dark:text-white text-start">{row.retained} {currency}</td>
                      <td className="px-6 py-4 text-[#666] dark:text-[#999] text-start">{row.date}</td>
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

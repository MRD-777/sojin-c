"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BarChart3, Users, HardHat, TrendingUp, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";

export default function ReportsPage() {
  const t = useTranslations("Common.dashboardPage");
  const [activeTab, setActiveTab] = useState<"engineers" | "managers" | "sla">("engineers");

  const engineersData = [
    { id: 1, name: "Omar Zaid", projects: 3, commitment: "95%", acceptance: "88%", response: "2h 15m", rating: "4.8/5" },
    { id: 2, name: "Yousef Ahmed", projects: 5, commitment: "92%", acceptance: "94%", response: "1h 45m", rating: "4.9/5" },
    { id: 3, name: "Khalid Hassan", projects: 2, commitment: "85%", acceptance: "76%", response: "5h 30m", rating: "4.1/5" },
    { id: 4, name: "Tariq Mansour", projects: 4, commitment: "98%", acceptance: "96%", response: "45m", rating: "5.0/5" },
  ];

  const managersData = [
    { id: 1, name: "Ahmed Ali", projects: 12, reviewTime: "4h 20m", completion: "94%" },
    { id: 2, name: "Mona Saad", projects: 8, reviewTime: "2h 10m", completion: "98%" },
    { id: 3, name: "Sami Nabil", projects: 15, reviewTime: "8h 45m", completion: "85%" },
  ];

  const slaData = [
    { id: "PRJ-001", name: t("table.p1"), compliance: "88%", breaches: 2, status: "warning" },
    { id: "PRJ-002", name: t("table.p2"), compliance: "99%", breaches: 0, status: "excellent" },
    { id: "PRJ-003", name: t("table.p3"), compliance: "75%", breaches: 5, status: "critical" },
  ];

  const tabs = [
    { id: "engineers", label: t("reports.tabEngineers"), icon: <HardHat className="w-4 h-4" /> },
    { id: "managers", label: t("reports.tabManagers"), icon: <Users className="w-4 h-4" /> },
    { id: "sla", label: t("reports.tabSla"), icon: <TrendingUp className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto">
      <Breadcrumbs />
      <header className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111] dark:text-white flex items-center gap-2">
            <BarChart3 className="w-8 h-8" />
            {t("reports.title")}
          </h1>
          <p className="text-sm text-[#666] dark:text-[#999] mt-2 max-w-2xl">
            {t("reports.subtitle")}
          </p>
        </div>
        <div>
          <Button className="bg-[#111] text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 gap-2">
            <Download className="w-4 h-4" />
            {t("audit.exportPdf")}
          </Button>
        </div>
      </header>

      {/* Custom Tabs */}
      <div className="flex border-b border-black/10 dark:border-white/10 mb-6 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${
              activeTab === tab.id
                ? "text-[#111] dark:text-white"
                : "text-[#666] dark:text-[#999] hover:text-[#111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#111] dark:bg-white" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "engineers" && (
          <Card className="border-black/5 dark:border-white/5">
            <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
              <CardTitle className="text-lg text-[#111] dark:text-white">
                {t("reports.tabEngineers")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                    <tr>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.engColName")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.engColProjects")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.engColCommitment")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.engColAcceptance")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.engColResponse")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.engColRating")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {engineersData.map((eng) => (
                      <tr key={eng.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-semibold text-[#111] dark:text-white">{eng.name}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc]">{eng.projects}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc]">{eng.commitment}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc]">{eng.acceptance}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc]">{eng.response}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium">{eng.rating}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "managers" && (
          <Card className="border-black/5 dark:border-white/5">
            <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
              <CardTitle className="text-lg text-[#111] dark:text-white">
                {t("reports.tabManagers")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                    <tr>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.mgrColName")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.mgrColProjects")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.mgrColReviewTime")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.mgrColCompletion")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {managersData.map((mgr) => (
                      <tr key={mgr.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-semibold text-[#111] dark:text-white">{mgr.name}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc]">{mgr.projects}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc]">{mgr.reviewTime}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc]">{mgr.completion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "sla" && (
          <Card className="border-black/5 dark:border-white/5">
            <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
              <CardTitle className="text-lg text-[#111] dark:text-white">
                {t("reports.tabSla")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                    <tr>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.slaColProject")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.slaColCompliance")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("reports.slaColBreaches")}</th>
                      <th className="px-6 py-4 font-medium text-start">{t("table.status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {slaData.map((sla) => (
                      <tr key={sla.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[#111] dark:text-white">{sla.name}</div>
                          <div className="text-xs text-[#666] dark:text-[#999]">{sla.id}</div>
                        </td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium">{sla.compliance}</td>
                        <td className="px-6 py-4 text-[#111] dark:text-[#ccc]">{sla.breaches}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            sla.status === 'critical' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20' : 
                            sla.status === 'warning' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' : 
                            'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20'
                          }`}>
                            {sla.status === 'critical' ? t("reports.statusCritical") : 
                             sla.status === 'warning' ? t("reports.statusWarning") : 
                             t("reports.statusExcellent")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

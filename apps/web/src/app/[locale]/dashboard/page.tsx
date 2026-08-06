"use client";

import { useTranslations } from "next-intl";
import { Building2, Wallet, AlertCircle, Clock, CheckCircle2, Users2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/global/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";

import { CashFlowChart, ProjectsPhaseChart } from "@/components/dashboard/overview-charts";

export default function DashboardOverviewPage() {
  const t = useTranslations("Common");

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto">
      <Breadcrumbs />
      <header className="mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111] dark:text-white">
          {t("nav.overview")}
        </h1>
        <p className="text-sm text-[#666] dark:text-[#999] mt-2 max-w-2xl">
          {t("dashboardPage.welcomeSub")}
        </p>
      </header>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title={t("dashboardPage.activeProjects")}
          value="12"
          icon={<Building2 className="w-5 h-5" />}
          trend={{ value: 8, isPositive: true, label: t("dashboardPage.fromLastMonth") }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("dashboardPage.totalRevenue")}
          value="$2.4M"
          icon={<Wallet className="w-5 h-5" />}
          trend={{ value: 12, isPositive: true, label: t("dashboardPage.fromLastMonth") }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("dashboardPage.workforce")}
          value="450"
          icon={<Users2 className="w-5 h-5" />}
          trend={{ value: 5, isPositive: true, label: t("dashboardPage.fromLastMonth") }}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("dashboardPage.pendingReviews")}
          value="5"
          icon={<AlertCircle className="w-5 h-5" />}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
      </div>

      {/* Main Content Area - Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        
        {/* Cash Flow Chart */}
        <div className="lg:col-span-2">
          <Card className="h-full border-black/5 dark:border-white/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-[#111] dark:text-white">{t("dashboardPage.cashFlow")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CashFlowChart />
            </CardContent>
          </Card>
        </div>

        {/* Actionable Approvals Widget */}
        <div className="h-full">
          <Card className="h-full flex flex-col border-black/5 dark:border-white/5">
            <CardHeader className="pb-4 shrink-0">
              <CardTitle className="text-lg flex items-center gap-2 text-[#111] dark:text-white">
                <Clock className="w-5 h-5 text-[#666] dark:text-[#999]" />
                {t("dashboardPage.recentTasks")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <div className="space-y-4">
                {[
                  { id: 1, title: t("dashboardPage.task1"), time: "2h ago" },
                  { id: 2, title: t("dashboardPage.task2"), time: "5h ago" },
                  { id: 3, title: t("dashboardPage.task3"), time: "1d ago" },
                ].map((task) => (
                  <div key={task.id} className="flex justify-between items-center p-3 rounded-lg border border-black/5 dark:border-white/5 bg-[#fafafa] dark:bg-[#111]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#111] dark:text-white">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#111] dark:text-white">{task.title}</p>
                        <p className="text-xs text-[#666] dark:text-[#999] mt-0.5">{task.time}</p>
                      </div>
                    </div>
                    <button className="text-xs font-medium text-[#111] dark:text-white bg-white dark:bg-[#222] border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 px-3 py-1.5 rounded-md transition-colors">
                      {t("dashboardPage.approveBtn")}
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content Area - Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        
        {/* Projects By Phase */}
        <div className="lg:col-span-2">
          <Card className="h-full border-black/5 dark:border-white/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-[#111] dark:text-white">{t("dashboardPage.projectsByPhase")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectsPhaseChart />
            </CardContent>
          </Card>
        </div>

        {/* Needs Attention */}
        <div>
          <Card className="border-black/5 dark:border-white/5 bg-[#fafafa] dark:bg-white/[0.02] h-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-[#111] dark:text-white flex items-center gap-2 text-lg">
                <AlertCircle className="w-5 h-5 text-[#666] dark:text-[#999]" />
                {t("dashboardPage.needsAttention")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-5">
                <li className="flex gap-3 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#111] dark:bg-white mt-2 shrink-0" />
                  <span className="text-[#666] dark:text-[#ccc] leading-relaxed">
                    {t.rich("dashboardPage.attentionMsg1", {
                      bold: (chunks) => <span className="font-semibold text-[#111] dark:text-white">{chunks}</span>
                    })}
                  </span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#666] dark:bg-[#999] mt-2 shrink-0" />
                  <span className="text-[#666] dark:text-[#ccc] leading-relaxed">
                    {t.rich("dashboardPage.attentionMsg2", {
                      bold: (chunks) => <span className="font-semibold text-[#111] dark:text-white">{chunks}</span>
                    })}
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Main Content Area - Row 3: Data Table */}
      <div className="mt-8">
        <Card className="border-black/5 dark:border-white/5">
          <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[#111] dark:text-white">
                {t("dashboardPage.recentProjects")}
              </CardTitle>
              <button className="text-sm font-medium text-[#111] dark:text-white hover:underline">
                {t("nav.allProjects")} &rarr;
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                  <tr>
                    <th className="px-6 py-4 font-medium">{t("dashboardPage.table.projectName")}</th>
                    <th className="px-6 py-4 font-medium">{t("dashboardPage.table.phase")}</th>
                    <th className="px-6 py-4 font-medium">{t("dashboardPage.table.progress")}</th>
                    <th className="px-6 py-4 font-medium">{t("dashboardPage.table.budgetUsed")}</th>
                    <th className="px-6 py-4 font-medium">{t("dashboardPage.table.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {[
                    { id: "PRJ-001", name: t("dashboardPage.table.p1"), phase: t("phases.structure"), progress: 45, budget: "45%", status: t("dashboardPage.delayed"), isWarning: true },
                    { id: "PRJ-002", name: t("dashboardPage.table.p2"), phase: t("phases.finishing"), progress: 82, budget: "80%", status: t("dashboardPage.onTrack"), isWarning: false },
                    { id: "PRJ-003", name: t("dashboardPage.table.p3"), phase: t("phases.excavation"), progress: 15, budget: "12%", status: t("dashboardPage.onTrack"), isWarning: false }
                  ].map((project, i) => (
                    <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#111] dark:text-white">{project.name}</div>
                        <div className="text-xs text-[#666] dark:text-[#999]">{project.id}</div>
                      </td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc]">{project.phase}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden max-w-[100px]">
                            <div className="bg-[#111] dark:bg-white h-full rounded-full" style={{ width: `${project.progress}%` }}></div>
                          </div>
                          <span className="text-[#111] dark:text-[#ccc] font-medium">{project.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#111] dark:text-[#ccc] font-medium">{project.budget}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.isWarning ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20' : 'bg-black/5 text-[#111] dark:bg-white/10 dark:text-white'}`}>
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
    </div>
  );
}

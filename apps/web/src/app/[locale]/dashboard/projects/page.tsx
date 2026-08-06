"use client";

import React, { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Building2,
  Search,
  Filter,
  Download,
  Plus,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  AlertCircle,
  Users,
  Calendar,
  DollarSign,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  Loader2,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";
import { useProjects } from "@/lib/hooks/use-projects";
import type { ProjectListItem, ProjectStatus } from "@/types/project";

// ─── helpers ───

/** Decimal(15,2) arrives as a string; format for display with a currency tag. */
function formatMoney(value: string | number, locale: string): string {
  const n = typeof value === "string" ? Number(value) : value;
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = new Intl.NumberFormat(
    locale === "ar" ? "ar-EG" : "en-US",
  ).format(safe);
  return locale === "ar" ? `${formatted} ر.س` : `${formatted} SAR`;
}

/** Whole days from now until an ISO date (null when no date). */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function ProjectsHubPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useProjects();

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  // Real 5-value backend enum → badge. Labels for DRAFT/CANCELLED are inline
  // bilingual (no i18n keys exist for them yet); the other three reuse existing
  // Common keys. There is no backend "delayed" status — it's a derived concept
  // that lives with the timeline data (Detail / S7), so it is not a row status.
  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case "IN_PROGRESS":
        return (
          <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20 hover:bg-blue-50/80">
            {t("dashboardPage.projects.statusActive")}
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge className="bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-200 dark:border-green-500/20 hover:bg-green-50/80">
            {t("dashboardPage.projects.statusCompleted")}
          </Badge>
        );
      case "ON_HOLD":
        return (
          <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 hover:bg-amber-50/80">
            {t("dashboardPage.projects.statusOnHold")}
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge className="bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20 hover:bg-red-50/80">
            {locale === "ar" ? "ملغي" : "Cancelled"}
          </Badge>
        );
      case "DRAFT":
      default:
        return (
          <Badge className="bg-black/5 text-[#666] dark:bg-white/10 dark:text-[#999] border-black/10 dark:border-white/10">
            {locale === "ar" ? "مسودة" : "Draft"}
          </Badge>
        );
    }
  };

  const getProgressBar = (progress: number) => {
    return (
      <div className="flex items-center gap-2">
        <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-[#111] dark:bg-white"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-[#111] dark:text-white min-w-[3.5ch]">
          {progress}%
        </span>
      </div>
    );
  };

  const projects: ProjectListItem[] = data?.items ?? [];

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto animate-in fade-in duration-700">
      <Breadcrumbs />
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-black/5 dark:border-white/5 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#666] dark:text-[#999] uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            {t("title")}
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#111] dark:text-white flex items-center gap-2 sm:gap-3">
            <Building2 className="w-7 h-7 sm:w-10 sm:h-10" />
            {t("dashboardPage.projects.title")}
          </h1>
          <p className="text-base text-[#666] dark:text-[#999] max-w-2xl leading-relaxed">
            {t("dashboardPage.projects.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button variant="outline" className="border-black/10 dark:border-white/10 text-[#111] dark:text-white gap-2 h-9 sm:h-11 px-3 sm:px-6 shadow-sm text-xs sm:text-sm">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t("dashboardPage.audit.exportExcel")}</span>
          </Button>
          <Button
            className="bg-[#111] text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 gap-2 h-9 sm:h-11 px-3 sm:px-6 shadow-lg shadow-black/10 dark:shadow-white/10 text-xs sm:text-sm"
            onClick={() => router.push(`./projects/new`)}
          >
            <Plus className="w-4 h-4" />
            {t("dashboardPage.projects.newProject")}
          </Button>
        </div>
      </header>

      {/* Filters & Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] md:col-span-3">
          <CardContent className="p-4 flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666] dark:text-[#999]" />
              {/* TODO(S3+): wire search/status/type filters to useProjects query params. UI-only for now. */}
              <Input
                placeholder={t("searchPlaceholder")}
                className="pl-10 h-10 border-black/10 dark:border-white/10 bg-white dark:bg-black rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 border-black/10 dark:border-white/10 gap-2">
                <Filter className="w-4 h-4" />
                {t("dashboardPage.projects.filterStatus")}
              </Button>
              <Button variant="outline" className="h-10 border-black/10 dark:border-white/10 gap-2">
                <Filter className="w-4 h-4" />
                {t("dashboardPage.projects.filterManager")}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/5 dark:border-white/5 bg-[#111] dark:bg-white">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="text-[10px] uppercase tracking-tighter text-[#999] dark:text-[#666] font-bold">
              {t("dashboardPage.activeProjects")}
            </div>
            <div className="text-2xl font-black text-white dark:text-black">
              {/* TODO(S5): active-only count needs a status filter; total for now. */}
              {data?.total ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <Card className="border-black/5 dark:border-white/5 overflow-hidden shadow-2xl shadow-black/5">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-[#666] dark:text-[#999]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">{t("loading")}</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div className="text-sm font-medium text-[#111] dark:text-white">
                {locale === "ar"
                  ? "تعذّر تحميل المشاريع"
                  : "Failed to load projects"}
              </div>
              <Button
                variant="outline"
                className="h-9 border-black/10 dark:border-white/10"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                {locale === "ar" ? "إعادة المحاولة" : "Retry"}
              </Button>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <Building2 className="w-8 h-8 text-[#999]" />
              <div className="text-sm font-medium text-[#111] dark:text-white">
                {locale === "ar" ? "لا توجد مشاريع بعد" : "No projects yet"}
              </div>
              <Button
                className="h-9 bg-[#111] text-white dark:bg-white dark:text-black gap-2"
                onClick={() => router.push(`./projects/new`)}
              >
                <Plus className="w-4 h-4" />
                {t("dashboardPage.projects.newProject")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start border-collapse">
                <thead>
                  <tr className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999] uppercase text-[11px] font-black tracking-widest">
                    <th className="w-12 px-6 py-5"></th>
                    <th className="px-6 py-5 text-start">{t("dashboardPage.projects.colName")}</th>
                    <th className="px-6 py-5 text-start">{t("dashboardPage.projects.colClient")}</th>
                    <th className="px-6 py-5 text-start">{t("dashboardPage.projects.colStatus")}</th>
                    <th className="px-6 py-5 text-start w-40">{t("dashboardPage.projects.colProgress")}</th>
                    <th className="px-6 py-5 text-start">{t("dashboardPage.projects.colBudget")}</th>
                    <th className="w-12 px-6 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {projects.map((project) => {
                    const remaining = daysUntil(project.expectedEndDate);
                    return (
                      <React.Fragment key={project.id}>
                        <tr
                          className={`group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all cursor-pointer ${expandedRow === project.id ? "bg-black/[0.03] dark:bg-white/[0.03]" : ""}`}
                          onClick={() => toggleRow(project.id)}
                        >
                          <td className="px-6 py-6 text-[#666] dark:text-[#999]">
                            {expandedRow === project.id ? (
                              <ChevronDown className="w-4 h-4 text-[#111] dark:text-white" />
                            ) : (
                              <ChevronRight className="w-4 h-4 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
                            )}
                          </td>
                          <td className="px-6 py-6">
                            <div className="font-bold text-[#111] dark:text-white text-base leading-tight">{project.name}</div>
                            <div className="text-[10px] font-mono text-[#999] mt-1">{project.id}</div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="text-[#111] dark:text-[#ccc] font-medium flex items-center gap-2">
                              <Building2 className="w-3 h-3 text-[#999]" />
                              {project.client?.name ?? "—"}
                            </div>
                          </td>
                          <td className="px-6 py-6">{getStatusBadge(project.status)}</td>
                          <td className="px-6 py-6">{getProgressBar(project.overallProgress)}</td>
                          <td className="px-6 py-6">
                            <div className="font-black text-[#111] dark:text-white">
                              {formatMoney(project.totalBudget, locale)}
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/10" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>

                        {/* Expanded row — driven by the LIST payload only.
                            Financials (certified/retention/margin), per-phase
                            breakdown, and external stakeholders are NOT in the
                            list response: they live on the Detail page and, for
                            money, on payments (S7). Shown here with explicit
                            TODOs rather than fabricated mock values. */}
                        {expandedRow === project.id && (
                          <tr className="bg-black/[0.03] dark:bg-white/[0.03] animate-in slide-in-from-top-2 duration-300">
                            <td colSpan={7} className="px-6 pb-10">
                              <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl p-8 shadow-inner">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 sm:gap-8">
                                  {/* Budget (real) + financial TODO */}
                                  <div className="xl:col-span-1 space-y-6">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-[#999] flex items-center gap-2">
                                      <DollarSign className="w-4 h-4 text-green-500" />
                                      {t("dashboardPage.projects.miniDashboard.financials")}
                                    </h4>
                                    <div className="space-y-4">
                                      <div className="p-4 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
                                        <div className="text-[10px] text-[#666] mb-1">{t("dashboardPage.projects.miniDashboard.contractValue")}</div>
                                        <div className="text-xl font-black text-[#111] dark:text-white">{formatMoney(project.totalBudget, locale)}</div>
                                      </div>
                                      {/* TODO(S7): certified invoices / retention come from payments. */}
                                      <div className="p-4 rounded-xl border border-dashed border-black/10 dark:border-white/10 text-[11px] text-[#999]">
                                        {locale === "ar"
                                          ? "المستخلصات والاحتجاز — تُربط مع المدفوعات (S7)"
                                          : "Invoices & retention — wired with payments (S7)"}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Timeline (real dates) */}
                                  <div className="xl:col-span-2 space-y-6">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-[#999] flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-blue-500" />
                                      {t("dashboardPage.projects.miniDashboard.timeline")}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <Card className="bg-black/5 dark:bg-white/10 border-none shadow-none">
                                        <CardContent className="p-4 flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-lg bg-white dark:bg-black flex items-center justify-center">
                                            <Calendar className="w-5 h-5 text-[#111] dark:text-white" />
                                          </div>
                                          <div>
                                            <div className="text-[10px] text-[#666]">{t("dashboardPage.projects.miniDashboard.remainingDays")}</div>
                                            <div className="text-xl font-black text-[#111] dark:text-white">
                                              {remaining === null
                                                ? "—"
                                                : `${remaining} ${locale === "ar" ? "يوم" : "days"}`}
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                      <Card className="bg-black/5 dark:bg-white/10 border-none shadow-none">
                                        <CardContent className="p-4 flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-lg bg-white dark:bg-black flex items-center justify-center">
                                            <Layers className="w-5 h-5 text-[#111] dark:text-white" />
                                          </div>
                                          <div>
                                            <div className="text-[10px] text-[#666]">
                                              {locale === "ar" ? "المراحل" : "Phases"}
                                            </div>
                                            <div className="text-xl font-black text-[#111] dark:text-white">
                                              {project._count.phases}
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                    {project.description && (
                                      <p className="text-sm text-[#666] dark:text-[#999] leading-relaxed pt-2">
                                        {project.description}
                                      </p>
                                    )}
                                  </div>

                                  {/* Stakeholders — owner is real (client). */}
                                  <div className="xl:col-span-1 space-y-6">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-[#999] flex items-center gap-2">
                                      <Users className="w-4 h-4 text-purple-500" />
                                      {t("dashboardPage.projects.miniDashboard.stakeholders")}
                                    </h4>
                                    <div className="space-y-4">
                                      <div>
                                        <div className="text-[10px] text-[#666] mb-1">{t("dashboardPage.projects.miniDashboard.owner")}</div>
                                        <div className="text-sm font-bold text-[#111] dark:text-white">{project.client?.name ?? "—"}</div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] text-[#666] mb-1">
                                          {locale === "ar" ? "أعضاء الفريق" : "Team members"}
                                        </div>
                                        <div className="text-sm font-bold text-[#111] dark:text-white">{project._count.assignments}</div>
                                      </div>
                                    </div>
                                    <div className="pt-6">
                                      <Button
                                        className="w-full bg-[#111] text-white dark:bg-white dark:text-black hover:scale-[1.02] transition-transform h-12 gap-2"
                                        onClick={() => router.push(`./projects/${project.id}`)}
                                      >
                                        {t("dashboardPage.projects.miniDashboard.openProject")}
                                        <ArrowUpRight className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

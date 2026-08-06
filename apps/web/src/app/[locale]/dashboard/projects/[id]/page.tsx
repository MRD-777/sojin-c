"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase, Building2, CheckCircle2,
  FileText, ShieldAlert, Users, TrendingUp,
  AlertTriangle, Download, Activity, UserCircle,
  HardHat, Tractor, Receipt, AlertCircle, Info, CalendarDays,
  FileSignature, Loader2, ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";
import { cn } from "@/lib/utils";
import { useProject } from "@/lib/hooks/use-project";
import { useMe } from "@/lib/hooks/use-me";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewsPanel } from "@/components/dashboard/updates/reviews-panel";
import { PhaseAdminControls } from "@/components/dashboard/projects/phase-admin-controls";
import { createIdempotencyKeyHolder } from "@/lib/api/idempotency-key";
import type {
  PhaseStatus,
  ProjectAssignment,
  ProjectRoleInProject,
  ProjectStatus,
  ProjectType,
} from "@/types/project";

// ─── display helpers ───
function formatMoney(value: string | number, locale: string): string {
  const n = typeof value === "string" ? Number(value) : value;
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = new Intl.NumberFormat(
    locale === "ar" ? "ar-EG" : "en-US",
  ).format(safe);
  return locale === "ar" ? `${formatted} ر.س` : `${formatted} SAR`;
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(
    locale === "ar" ? "ar-EG" : "en-US",
  );
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const TYPE_LABELS: Record<ProjectType, { ar: string; en: string }> = {
  FULL_FINISHING: { ar: "تشطيب كامل", en: "Full finishing" },
  PARTIAL_FINISHING: { ar: "تشطيب جزئي", en: "Partial finishing" },
  CONSTRUCTION: { ar: "إنشاءات", en: "Construction" },
};

const ROLE_LABELS: Record<ProjectRoleInProject, { ar: string; en: string }> = {
  SITE_ENGINEER: { ar: "مهندس موقع", en: "Site engineer" },
  SUPERVISOR: { ar: "مشرف", en: "Supervisor" },
  ACCOUNTANT: { ar: "محاسب", en: "Accountant" },
  WORKER: { ar: "عامل", en: "Worker" },
  FOREMAN: { ar: "مقاول/فورمان", en: "Foreman" },
};

export default function ProjectDetailsPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params?.id as string;

  const { data: project, isLoading, isError, refetch, isRefetching } =
    useProject(projectId);
  const { data: me } = useMe();
  // Open directly on the reviews tab when linked with ?tab=reviews (e.g. from
  // the Review Inbox project-picker). One-directional: the initial value is
  // read once from the URL; switching tabs is NOT written back to the URL
  // (bidirectional sync stays deferred — WEB-S4 decision #1).
  const [detailTab, setDetailTab] = React.useState(
    searchParams.get("tab") === "reviews" ? "reviews" : "phases",
  );

  // CVE-S4-001 (NEEDS-CODER): the Idempotency-Key holders for approve /
  // force-cancel live HERE, on the page, not inside the review Dialog. The
  // Dialog sits inside a base-ui Tabs.Panel that unmounts when inactive
  // (keepMounted defaults to false), so a holder owned by the Dialog/panel
  // would be destroyed on a tab switch — decoupling the key's lifetime from
  // any child mount makes the stability guarantee immune to remounts. Lazy
  // init (useState initializer) creates each holder exactly once for the
  // page's lifetime; ReviewsPanel resets them when a new update is opened.
  const [approveKey] = React.useState(() => createIdempotencyKeyHolder());
  const [cancelKey] = React.useState(() => createIdempotencyKeyHolder());

  // ── loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-[#666] dark:text-[#999]">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">{t("loading")}</span>
      </div>
    );
  }

  // ── error / not-found (404 arrives as isError, NOT a 401 → guard never
  //    redirects; we render a not-found panel here instead) ──
  if (isError || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-32 text-center">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[#111] dark:text-white">
            {locale === "ar" ? "المشروع غير موجود" : "Project not found"}
          </h2>
          <p className="text-sm text-[#666] dark:text-[#999]">
            {locale === "ar"
              ? "تعذّر تحميل هذا المشروع أو ليس لديك صلاحية الوصول إليه."
              : "This project could not be loaded or you don't have access."}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="h-9 border-black/10 dark:border-white/10 gap-2"
            onClick={() => router.push(`../`)}
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {locale === "ar" ? "رجوع للمشاريع" : "Back to projects"}
          </Button>
          <Button
            className="h-9 bg-[#111] text-white dark:bg-white dark:text-black"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {locale === "ar" ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      </div>
    );
  }

  const remaining = daysUntil(project.expectedEndDate);
  const teamCount = project.assignments.length;

  // Role gates (UX only — the backend is the real authority).
  const role = me?.role;
  const canReview = role === "SUPER_ADMIN" || role === "PROJECT_MANAGER";
  const canForceCancel = role === "SUPER_ADMIN";
  // PATCH /phases/:id/{progress,reorder} both require SUPER_ADMIN|PROJECT_MANAGER.
  const canManagePhases = role === "SUPER_ADMIN" || role === "PROJECT_MANAGER";

  // Real workforce distribution derived from assignments (roleInProject).
  const workforceDistribution = Object.values(
    project.assignments.reduce<
      Record<string, { role: ProjectRoleInProject; count: number }>
    >((acc, a) => {
      acc[a.roleInProject] ??= { role: a.roleInProject, count: 0 };
      acc[a.roleInProject].count += 1;
      return acc;
    }, {}),
  );

  // ── project-level status badge (real 5-value enum) ──
  const getStatusBadge = (status: ProjectStatus) => {
    const base = "px-3 py-1 text-sm";
    switch (status) {
      case "IN_PROGRESS":
        return <Badge className={cn(base, "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20")}>{t("dashboardPage.projects.statusActive")}</Badge>;
      case "COMPLETED":
        return <Badge className={cn(base, "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20")}>{t("dashboardPage.projects.statusCompleted")}</Badge>;
      case "ON_HOLD":
        return <Badge className={cn(base, "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20")}>{t("dashboardPage.projects.statusOnHold")}</Badge>;
      case "CANCELLED":
        return <Badge className={cn(base, "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20")}>{locale === "ar" ? "ملغي" : "Cancelled"}</Badge>;
      case "DRAFT":
      default:
        return <Badge className={cn(base, "bg-black/5 text-[#666] dark:bg-white/10 dark:text-[#999] border-black/10 dark:border-white/10")}>{locale === "ar" ? "مسودة" : "Draft"}</Badge>;
    }
  };

  const getProgressBar = (progress: number, completed?: boolean) => {
    const colorClass = completed ? "bg-emerald-500" : "bg-[#111] dark:bg-white";
    return (
      <div className="flex items-center gap-3 w-full">
        <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", colorClass)}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-bold text-[#111] dark:text-white min-w-[3.5ch]">{progress}%</span>
      </div>
    );
  };

  const isPhaseDone = (status: PhaseStatus) => status === "COMPLETED";

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto animate-in fade-in duration-700">
      <Breadcrumbs />

      {/* Section 1: Header (real: name, status, id, owner) */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-black/5 dark:border-white/5 pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#111] dark:text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-blue-400" />
              {project.name}
            </h1>
            {getStatusBadge(project.status)}
            <Badge variant="outline" className="font-mono text-[#666] dark:text-[#999] border-black/10 dark:border-white/10 bg-transparent">
              {project.id}
            </Badge>
          </div>
          <p className="text-base sm:text-lg text-[#666] dark:text-[#999] max-w-3xl leading-relaxed">
            {locale === "ar" ? "المالك: " : "Owner: "}
            <span className="font-semibold text-[#111] dark:text-white">{project.client?.name ?? "—"}</span>
          </p>
          {project.description && (
            <p className="text-sm text-[#666] dark:text-[#999] max-w-3xl leading-relaxed">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button variant="outline" className="border-black/10 dark:border-white/10 text-[#111] dark:text-white gap-2 h-9 sm:h-11 px-3 sm:px-6 shadow-sm text-xs sm:text-sm">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{locale === "ar" ? "تحميل تقرير شامل" : "Download report"}</span>
          </Button>
          <Button className="bg-[#111] text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 gap-2 h-9 sm:h-11 px-3 sm:px-6 shadow-lg shadow-black/10 dark:shadow-white/10 text-xs sm:text-sm">
            <Briefcase className="w-4 h-4" />
            <span className="hidden sm:inline">{locale === "ar" ? "مساحة عمل المشروع" : "Workspace"}</span>
          </Button>
        </div>
      </header>

      {/* Section 2: KPI Strip — real where available, TODO for financials */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-[#111111] hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666] dark:text-[#999] mb-1">{locale === "ar" ? "الإنجاز الكلي" : "Overall progress"}</p>
                <h3 className="text-2xl font-black text-[#111] dark:text-white">{project.overallProgress}%</h3>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-4">{getProgressBar(project.overallProgress, project.status === "COMPLETED")}</div>
          </CardContent>
        </Card>

        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-[#111111] hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666] dark:text-[#999] mb-1">{locale === "ar" ? "الميزانية الكلية" : "Total budget"}</p>
                <h3 className="text-xl font-bold text-[#111] dark:text-white">{formatMoney(project.totalBudget, locale)}</h3>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                <FileSignature className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "النوع:" : "Type:"}</span>
              <span className="font-semibold text-[#111] dark:text-white text-xs">{TYPE_LABELS[project.type][locale === "ar" ? "ar" : "en"]}</span>
            </div>
          </CardContent>
        </Card>

        {/* TODO(S7): certified invoices come from payments. */}
        <Card className="border-dashed border-black/10 dark:border-white/10 shadow-sm bg-white dark:bg-[#111111]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666] dark:text-[#999] mb-1">{t("dashboardPage.projects.miniDashboard.contractValue") /* placeholder label */}</p>
                <h3 className="text-xl font-bold text-[#999]">—</h3>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="mt-4 text-[11px] text-[#999]">{locale === "ar" ? "المستخلصات — payments (S7)" : "Invoices — payments (S7)"}</div>
          </CardContent>
        </Card>

        {/* TODO(S7): profit margin needs payments/costs. */}
        <Card className="border-dashed border-black/10 dark:border-white/10 shadow-sm bg-white dark:bg-[#111111]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666] dark:text-[#999] mb-1">{locale === "ar" ? "هامش الربح" : "Profit margin"}</p>
                <h3 className="text-2xl font-bold text-[#999]">—</h3>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-500/10 rounded-xl">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-4 text-[11px] text-[#999]">{locale === "ar" ? "يُحتسب مع payments (S7)" : "Computed with payments (S7)"}</div>
          </CardContent>
        </Card>

        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-[#111111] hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666] dark:text-[#999] mb-1">{locale === "ar" ? "الأيام المتبقية" : "Remaining days"}</p>
                <h3 className="text-2xl font-bold text-[#111] dark:text-white">{remaining === null ? "—" : `${remaining} ${locale === "ar" ? "يوم" : "d"}`}</h3>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl">
                <CalendarDays className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "النهاية:" : "End:"}</span>
              <span className="font-semibold text-[#111] dark:text-white text-xs">{formatDate(project.expectedEndDate, locale)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-[#111111] hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666] dark:text-[#999] mb-1">{locale === "ar" ? "أعضاء الفريق" : "Team members"}</p>
                <h3 className="text-2xl font-black text-[#111] dark:text-white">{teamCount}</h3>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-xl">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "المراحل:" : "Phases:"}</span>
              <span className="font-semibold text-[#111] dark:text-white text-xs">{project.phases.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Admin info — location/type real; contract meta TODO */}
      <Card className="border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-[#111111]">
        <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
          <CardTitle className="text-xl font-bold text-[#111] dark:text-white">{locale === "ar" ? "معلومات المشروع" : "Project info"}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h4 className="font-semibold text-[#111] dark:text-white border-b border-black/5 dark:border-white/5 pb-2">{locale === "ar" ? "التواريخ" : "Dates"}</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "البداية:" : "Start:"}</span><span className="font-medium text-[#111] dark:text-white">{formatDate(project.startDate, locale)}</span></div>
                <div className="flex justify-between"><span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "النهاية المتوقعة:" : "Expected end:"}</span><span className="font-medium text-[#111] dark:text-white">{formatDate(project.expectedEndDate, locale)}</span></div>
                <div className="flex justify-between"><span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "موعد التحديث اليومي:" : "Daily deadline:"}</span><span className="font-medium text-[#111] dark:text-white">{project.dailyUpdateDeadline}</span></div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-[#111] dark:text-white border-b border-black/5 dark:border-white/5 pb-2">{locale === "ar" ? "الأطراف" : "Parties"}</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "المالك:" : "Owner:"}</span><span className="font-medium text-[#111] dark:text-white">{project.client?.name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "البريد:" : "Email:"}</span><span className="font-medium text-[#111] dark:text-white text-xs">{project.client?.email ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "أعضاء الفريق:" : "Team:"}</span><span className="font-medium text-[#111] dark:text-white">{teamCount}</span></div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-[#111] dark:text-white border-b border-black/5 dark:border-white/5 pb-2">{locale === "ar" ? "الموقع والتصنيف" : "Location & type"}</h4>
              <div className="space-y-3 text-sm">
                <div className="flex flex-col gap-1"><span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "الموقع:" : "Location:"}</span><span className="font-medium text-[#111] dark:text-white">{project.location ?? "—"}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[#666] dark:text-[#999]">{locale === "ar" ? "التصنيف:" : "Type:"}</span><span className="font-medium text-[#111] dark:text-white">{TYPE_LABELS[project.type][locale === "ar" ? "ar" : "en"]}</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Phases + per-project Review Inbox (S4) — tabbed */}
      <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as string)}>
        <TabsList variant="line" className="mb-3">
          <TabsTrigger value="phases">{locale === "ar" ? "المراحل الإنشائية" : "Phases"}</TabsTrigger>
          <TabsTrigger value="reviews">{locale === "ar" ? "مراجعة التحديثات" : "Reviews"}</TabsTrigger>
        </TabsList>

        <TabsContent value="phases">
          <Card className="border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-[#111111]">
            <CardContent className="p-0">
              {project.phases.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#666] dark:text-[#999]">{locale === "ar" ? "لا توجد مراحل بعد" : "No phases yet"}</div>
              ) : (
                <div className="divide-y divide-black/5 dark:divide-white/5">
                  {project.phases.map((phase, index, arr) => (
                    <div key={phase.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#111] dark:text-white text-sm">{phase.name}</span>
                          {isPhaseDone(phase.status) && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </div>
                        <p className="text-xs text-[#666] dark:text-[#999]">
                          {locale === "ar" ? "الوزن" : "Weight"}: {phase.weight} · {locale === "ar" ? "الميزانية" : "Budget"}: {formatMoney(phase.budget, locale)}
                        </p>
                      </div>
                      <div className="w-full sm:w-1/3">{getProgressBar(phase.progress, isPhaseDone(phase.status))}</div>
                      {canManagePhases && (
                        <PhaseAdminControls
                          phase={{ id: phase.id, name: phase.name, order: phase.order, progress: phase.progress }}
                          projectId={project.id}
                          prevPhase={index > 0 ? { id: arr[index - 1].id, order: arr[index - 1].order } : null}
                          nextPhase={index < arr.length - 1 ? { id: arr[index + 1].id, order: arr[index + 1].order } : null}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card className="border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-[#111111]">
            <CardContent className="p-4 sm:p-6">
              <ReviewsPanel
                projectId={project.id}
                phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
                active={detailTab === "reviews"}
                canReview={canReview}
                canForceCancel={canForceCancel}
                approveKey={approveKey}
                cancelKey={cancelKey}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Section 5: Team (REAL — assignments) + workforce distribution */}
      <Card className="border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-[#111111]">
        <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
          <CardTitle className="text-xl font-bold text-[#111] dark:text-white flex items-center gap-2">
            <HardHat className="w-5 h-5 text-[#666] dark:text-[#999]" />
            {locale === "ar" ? `الفريق (${teamCount})` : `Team (${teamCount})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {project.assignments.length === 0 ? (
            <div className="text-center text-sm text-[#666] dark:text-[#999] py-6">{locale === "ar" ? "لا يوجد أعضاء معيّنون" : "No members assigned"}</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {workforceDistribution.map((item) => (
                  <div key={item.role} className="flex justify-between items-center p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                    <span className="text-xs text-[#666] dark:text-[#999]">{ROLE_LABELS[item.role][locale === "ar" ? "ar" : "en"]}</span>
                    <span className="font-bold text-sm text-[#111] dark:text-white">{item.count}</span>
                  </div>
                ))}
              </div>
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {project.assignments.map((a: ProjectAssignment) => (
                  <div key={a.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserCircle className="w-8 h-8 text-[#999]" />
                      <div>
                        <p className="text-sm font-bold text-[#111] dark:text-white">{a.user.name}</p>
                        <p className="text-xs text-[#666] dark:text-[#999]">{a.user.email}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-black/10 dark:border-white/10">
                      {ROLE_LABELS[a.roleInProject][locale === "ar" ? "ar" : "en"]}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 6: Financial position — TODO(S7): wired with payments */}
      <Card className="border-dashed border-black/10 dark:border-white/10 shadow-sm bg-white dark:bg-[#111111]">
        <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
          <CardTitle className="text-xl font-bold text-[#111] dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#999]" />
            {locale === "ar" ? "الموقف المالي والمستخلصات" : "Financial position"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center text-sm text-[#666] dark:text-[#999]">
          {/* TODO(S7): payments module — spent / certified / invoices list.
              Deferred behind BACKLOG R-1 (financial data is "heavy"). */}
          {locale === "ar"
            ? "تُربط بيانات المدفوعات والمستخلصات مع وحدة المالية (S7)."
            : "Payments & invoices are wired with the finance module (S7)."}
        </CardContent>
      </Card>

      {/* Section 7: Subcontractors / Alerts — TODO(no backend in detail) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
        <Card className="border-dashed border-black/10 dark:border-white/10 shadow-sm bg-white dark:bg-[#111111]">
          <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
            <CardTitle className="text-xl font-bold text-[#111] dark:text-white flex items-center gap-2">
              <Tractor className="w-5 h-5 text-[#999]" />
              {locale === "ar" ? "مقاولو الباطن" : "Subcontractors"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center text-sm text-[#666] dark:text-[#999]">
            {/* TODO(S10): sub-contractors module. */}
            {locale === "ar" ? "تُربط في S10." : "Wired in S10."}
          </CardContent>
        </Card>

        <Card className="border-dashed border-black/10 dark:border-white/10 shadow-sm bg-white dark:bg-[#111111]">
          <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
            <CardTitle className="text-xl font-bold text-[#111] dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#999]" />
              {locale === "ar" ? "سجل المخاطر والتنبيهات" : "Risks & alerts"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center text-sm text-[#666] dark:text-[#999]">
            {/* TODO: no backend for alerts yet. */}
            <div className="flex items-center justify-center gap-2">
              <Info className="w-4 h-4" />
              {locale === "ar" ? "لا يوجد مصدر بيانات بعد." : "No data source yet."}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 8: Activity log — TODO(S9): audit-logs */}
      <Card className="border-dashed border-black/10 dark:border-white/10 shadow-sm bg-white dark:bg-[#111111]">
        <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
          <CardTitle className="text-xl font-bold text-[#111] dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#999]" />
            {locale === "ar" ? "سجل النشاطات" : "Activity log"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center text-sm text-[#666] dark:text-[#999]">
          {/* TODO(S9): audit-logs endpoint. */}
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {locale === "ar" ? "يُربط بسجل التدقيق (S9)." : "Wired with audit log (S9)."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

// ============================================
// Review Inbox — project picker (WEB-S4-P7-001)
//
// There is no global "pending updates across all projects" endpoint; the
// Review Inbox lives as a tab INSIDE project detail (bounded aggregation over
// a single project's phases — the S4 decision that avoids the N×M over-fetch).
// This page is therefore a picker: it lists the real projects and links each
// one to its reviews tab (`?tab=reviews`). Per-project pending counts would
// need N×M calls and are deferred to a backend counter endpoint.
// ============================================

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Building2,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";
import { useProjects } from "@/lib/hooks/use-projects";
import type { ProjectListItem, ProjectStatus } from "@/types/project";

export default function ProjectReviewsPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const { data, isLoading, isError, refetch, isRefetching } = useProjects();
  const projects: ProjectListItem[] = data?.items ?? [];

  // Same 5-value backend enum → badge as the projects list. Labels for
  // DRAFT/CANCELLED are inline bilingual (no i18n keys yet); the rest reuse
  // existing Common keys.
  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case "IN_PROGRESS":
        return (
          <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20">
            {t("dashboardPage.projects.statusActive")}
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge className="bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-200 dark:border-green-500/20">
            {t("dashboardPage.projects.statusCompleted")}
          </Badge>
        );
      case "ON_HOLD":
        return (
          <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20">
            {t("dashboardPage.projects.statusOnHold")}
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge className="bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20">
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

  // From /dashboard/projects/reviews the parent dir is /dashboard/projects/,
  // so `./${id}` resolves to the project detail route (same relative style the
  // projects list uses). ?tab=reviews opens straight on the reviews tab.
  const openReviews = (id: string) => router.push(`./${id}?tab=reviews`);

  return (
    <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-700">
      <Breadcrumbs />

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40 relative">
        <div className="absolute top-0 left-0 w-32 h-32 bg-[var(--blueprint-accent)] opacity-10 blur-3xl rounded-full -z-10" />
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--blueprint-ambient)] text-[var(--blueprint-accent)] text-xs font-black uppercase tracking-widest border border-[var(--blueprint-accent)]/20 shadow-sm">
            <ClipboardCheck className="w-4 h-4" />
            <span>{locale === "ar" ? "مركز الاعتمادات" : "Approvals hub"}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
            {t("nav.projects_reviews")}
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
            {locale === "ar"
              ? "المراجعة تتم داخل كل مشروع. اختر مشروعاً لعرض التحديثات المعلّقة واعتمادها أو رفضها."
              : "Reviews happen per project. Pick a project to see its pending updates and approve or reject them."}
          </p>
        </div>
      </header>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">{t("loading")}</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div className="text-sm font-medium text-foreground">
            {locale === "ar" ? "تعذّر تحميل المشاريع" : "Failed to load projects"}
          </div>
          <Button
            variant="outline"
            className="h-9 border-border/50"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {locale === "ar" ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <Building2 className="w-8 h-8 text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">
            {locale === "ar" ? "لا توجد مشاريع بعد" : "No projects yet"}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => openReviews(project.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openReviews(project.id);
                }
              }}
              className="group border-border/40 bg-card hover:bg-card/60 hover:shadow-md transition-all duration-300 rounded-2xl cursor-pointer overflow-hidden"
            >
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[var(--blueprint-ambient)] flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-[var(--blueprint-accent)]" />
                  </div>
                  {getStatusBadge(project.status)}
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-black text-foreground leading-tight">
                    {project.name}
                  </h3>
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {project.client?.name ?? "—"}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {locale === "ar"
                      ? `${project._count.phases} مرحلة`
                      : `${project._count.phases} phases`}
                  </div>
                  <Button
                    variant="ghost"
                    className="h-9 px-3 gap-2 text-[var(--blueprint-accent)] group-hover:bg-[var(--blueprint-ambient)] rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      openReviews(project.id);
                    }}
                  >
                    {locale === "ar" ? "مراجعة التحديثات" : "Review updates"}
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

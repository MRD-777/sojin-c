"use client";
// ============================================
// PhaseReportButton — the authoring entry point on a phase row (Session A)
//
// Sits next to PhaseAdminControls inside the Phases tab of project detail. It
// reuses the SAME list query the Review panel fans out over
// (phaseUpdatesQueryOptions) so there is no second key or fetch path, and it is
// gated on `active` for the same reason ReviewsPanel is: don't fetch a tab the
// user isn't looking at.
//
// 🔴 Why there is no "you already reported today" badge here:
// "today" is a COMPANY-TIMEZONE question — the backend computes the day window
// from Company.timezone (updates.service.ts:235-240). Re-deriving it from the
// browser clock would create a second source for one fact and would be wrong
// around midnight or for a user in another zone. So this button never tries to
// decide whether today is taken: a DRAFT/REJECTED row of mine is continuable
// regardless of date (editDraft has no date check — updates.service.ts:310-319),
// and anything else is left to the backend's 409, which the dialog turns into
// continue-mode or a locked view.
// ============================================
import { useState } from "react";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { phaseUpdatesQueryOptions } from "@/lib/hooks/use-phase-updates";
import { STATUS_META } from "./update-detail-dialog";
import { ReportFormDialog } from "./report-form-dialog";
import type { UpdateListItem } from "@/types/update";

interface Props {
  phase: { id: string; name: string };
  projectId: string;
  /** Current user id — used to pick out MY continuable report. */
  userId: string | undefined;
  /** Only fetch while the Phases tab is the active one. */
  active: boolean;
}

/** My newest report on this phase, whatever its status (badge source). */
function findMyLatest(
  items: UpdateListItem[] | undefined,
  userId: string | undefined,
): UpdateListItem | null {
  if (!items || !userId) return null;
  const mine = items.filter((u) => u.submitter.id === userId);
  if (mine.length === 0) return null;
  return mine.reduce((newest, u) =>
    new Date(u.createdAt) > new Date(newest.createdAt) ? u : newest,
  );
}

export function PhaseReportButton({ phase, projectId, userId, active }: Props) {
  const locale = useLocale();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);

  // No status filter: for a field role the backend already narrows rows to
  // "own ∪ APPROVED" (updates.service.ts:97-109), which is exactly what we need
  // to spot my own DRAFT/REJECTED without asking for anything extra.
  const { data } = useQuery(phaseUpdatesQueryOptions(phase.id, {}, active));
  const latest = findMyLatest(data?.items, userId);
  // Only DRAFT/REJECTED is continuable — and it is continuable on ANY date,
  // which is what keeps this component free of day-boundary logic.
  const continuable =
    latest && (latest.status === "DRAFT" || latest.status === "REJECTED")
      ? latest
      : null;

  return (
    <div className="flex items-center gap-2">
      {latest && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {ar ? "آخر تقرير:" : "Last report:"}
          <Badge className={STATUS_META[latest.status].cls}>
            {STATUS_META[latest.status][ar ? "ar" : "en"]}
          </Badge>
        </span>
      )}
      <Button
        variant="outline"
        size="lg"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        {continuable ? (
          <PencilLine className="w-4 h-4" />
        ) : (
          <FilePlus2 className="w-4 h-4" />
        )}
        {continuable
          ? ar
            ? "متابعة التقرير"
            : "Continue report"
          : ar
            ? "تقرير يومي"
            : "Daily report"}
      </Button>

      {open && (
        <ReportFormDialog
          phase={phase}
          projectId={projectId}
          userId={userId}
          existing={continuable}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

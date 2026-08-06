"use client";
// ============================================
// ReviewsPanel — per-project review inbox (S4, decision Q1 = ج)
//
// There is NO global "pending updates" endpoint — only
// GET /phases/:phaseId/updates. So we aggregate WITHIN one project: fan out
// across the project's phases with useQueries (bounded by phase count) using
// phaseUpdatesQueryOptions so keys match the single-phase hook exactly (no
// drift). We only fetch while the reviews tab is active (`active` → enabled) to
// avoid over-fetching the whole project every detail render.
//
// Clicking a row opens the UpdateDetailDialog, which owns the actions +
// idempotency keys. Status toggle (PENDING/APPROVED) lets an admin reach the
// APPROVED rows that force-cancel operates on.
// ============================================
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { AlertTriangle, ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { phaseUpdatesQueryOptions } from "@/lib/hooks/use-phase-updates";
import { UpdateDetailDialog } from "./update-detail-dialog";
import type { IdempotencyKeyHolder } from "@/lib/api/idempotency-key";
import type { UpdateListItem, UpdateStatus } from "@/types/update";

interface PhaseRef {
  id: string;
  name: string;
}

interface Props {
  projectId: string;
  phases: PhaseRef[];
  /** Only fetch while the reviews tab is active. */
  active: boolean;
  canReview: boolean;
  canForceCancel: boolean;
  /** Page-owned Idempotency-Key holders (survive this panel's unmount on tab
   *  switch). Reset here on open so each opened update starts a fresh action. */
  approveKey: IdempotencyKeyHolder;
  cancelKey: IdempotencyKeyHolder;
}

type Row = UpdateListItem & { phaseId: string; phaseName: string };

export function ReviewsPanel({
  projectId,
  phases,
  active,
  canReview,
  canForceCancel,
  approveKey,
  cancelKey,
}: Props) {
  const locale = useLocale();
  const ar = locale === "ar";

  const [status, setStatus] = useState<UpdateStatus>("PENDING");
  const [openId, setOpenId] = useState<string | null>(null);

  // Opening an update begins a NEW logical action → drop any key cached from a
  // previously-opened update so it can't be replayed against this one.
  const openUpdate = (id: string) => {
    approveKey.reset();
    cancelKey.reset();
    setOpenId(id);
  };

  const results = useQueries({
    queries: phases.map((p) =>
      phaseUpdatesQueryOptions(p.id, { status }, active),
    ),
  });

  const isLoading = active && results.some((r) => r.isLoading && r.isFetching);
  const isError = results.some((r) => r.isError);

  // Flatten every phase's items, tagging each with its phase for display + the
  // detail dialog's invalidation context.
  const rows = useMemo<Row[]>(() => {
    return results.flatMap((r, i) =>
      (r.data?.items ?? []).map((u) => ({
        ...u,
        phaseId: phases[i].id,
        phaseName: phases[i].name,
      })),
    );
  }, [results, phases]);

  return (
    <div className="space-y-4">
      {/* Status toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-muted p-[3px]">
          {(["PENDING", "APPROVED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={
                "px-3 py-1 text-sm font-medium rounded-md transition-colors " +
                (status === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {s === "PENDING"
                ? ar
                  ? "قيد المراجعة"
                  : "Pending"
                : ar
                  ? "معتمدة"
                  : "Approved"}
            </button>
          ))}
        </div>
        <Badge variant="outline" className="font-mono">
          {rows.length}
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{ar ? "جارٍ التحميل…" : "Loading…"}</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <p className="text-sm text-muted-foreground">
            {ar
              ? "تعذّر تحميل بعض التحديثات."
              : "Some updates could not be loaded."}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <ClipboardCheck className="w-6 h-6" />
          <p className="text-sm">
            {status === "PENDING"
              ? ar
                ? "لا توجد تحديثات معلّقة للمراجعة."
                : "No pending updates to review."
              : ar
                ? "لا توجد تحديثات معتمدة."
                : "No approved updates."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => openUpdate(row.id)}
              className="w-full text-start py-3 px-2 flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors rounded-md"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-sm text-foreground truncate">
                  {row.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.phaseName} · {row.submitter.name} · +
                  {row.progressIncrement}%
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(row.createdAt).toLocaleDateString(
                  ar ? "ar-EG" : "en-US",
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      <UpdateDetailDialog
        updateId={openId}
        projectId={projectId}
        onClose={() => setOpenId(null)}
        canReview={canReview}
        canForceCancel={canForceCancel}
        approveKey={approveKey}
        cancelKey={cancelKey}
      />
    </div>
  );
}

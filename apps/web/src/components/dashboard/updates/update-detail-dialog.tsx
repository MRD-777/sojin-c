"use client";
// ============================================
// UpdateDetailDialog — review an update + take a lifecycle action (S4)
//
// Idempotency-Key lifecycle (the sensitive part):
//   • approve & force-cancel each use a stable IdempotencyKeyHolder that is
//     OWNED BY THE PAGE and passed in as a prop (CVE-S4-001): this dialog lives
//     inside a base-ui Tabs.Panel that unmounts when inactive, so a holder kept
//     in this component's own useRef would be destroyed on a tab switch and a
//     retry could then double-apply. Owning it on the page decouples the key's
//     lifetime from this component's mount.
//   • holder.current() lazily generates ONE key on first confirm-click and
//     returns that same key on any re-invocation (retry / re-click), so the
//     backend replays instead of double-applying. On success we reset() so the
//     NEXT action starts a fresh key. The parent (ReviewsPanel) resets both
//     holders whenever a new update is opened — a new update never inherits a
//     prior key.
//
// No optimistic UI: every action reflects only server-confirmed state (the
// mutations invalidate + refetch). Actions are role-gated for UX only — the
// backend is the real authority.
// ============================================
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useUpdate } from "@/lib/hooks/use-update";
import {
  useApproveUpdate,
  useForceCancelUpdate,
  useRejectUpdate,
} from "@/lib/hooks/use-update-actions";
import type { IdempotencyKeyHolder } from "@/lib/api/idempotency-key";
import type { UpdateStatus } from "@/types/update";

const REJECT_REASON_MIN = 10;
const FORCE_CANCEL_REASON_MIN = 20;

function formatMoney(value: string, locale: string): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = new Intl.NumberFormat(
    locale === "ar" ? "ar-EG" : "en-US",
  ).format(safe);
  return locale === "ar" ? `${formatted} ر.س` : `${formatted} SAR`;
}

const STATUS_META: Record<
  UpdateStatus,
  { ar: string; en: string; cls: string }
> = {
  DRAFT: { ar: "مسودة", en: "Draft", cls: "bg-black/5 text-[#666] dark:bg-white/10 dark:text-[#999]" },
  PENDING: { ar: "قيد المراجعة", en: "Pending", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  APPROVED: { ar: "معتمد", en: "Approved", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  REJECTED: { ar: "مرفوض", en: "Rejected", cls: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  FORCE_CANCELLED: { ar: "ملغي قسرياً", en: "Force-cancelled", cls: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
};

interface Props {
  /** Which update to show; null closes the dialog. */
  updateId: string | null;
  projectId: string;
  onClose: () => void;
  /** SUPER_ADMIN | PROJECT_MANAGER — may approve/reject. */
  canReview: boolean;
  /** SUPER_ADMIN only — may force-cancel an approved update. */
  canForceCancel: boolean;
  /** Page-owned holders (see file header): stable across this dialog's mount. */
  approveKey: IdempotencyKeyHolder;
  cancelKey: IdempotencyKeyHolder;
}

export function UpdateDetailDialog({
  updateId,
  projectId,
  onClose,
  canReview,
  canForceCancel,
  approveKey,
  cancelKey,
}: Props) {
  const locale = useLocale();
  const ar = locale === "ar";

  const { data: update, isLoading, isError } = useUpdate(updateId ?? "");

  const approve = useApproveUpdate();
  const reject = useRejectUpdate();
  const forceCancel = useForceCancelUpdate();

  const [mode, setMode] = useState<"view" | "reject" | "force-cancel">("view");
  const [reason, setReason] = useState("");

  // A new update starts clean UI. The holders themselves are reset by the
  // parent (ReviewsPanel) on open, so a new update never inherits a prior key.
  useEffect(() => {
    setMode("view");
    setReason("");
  }, [updateId]);

  if (updateId === null) return null;

  const busy = approve.isPending || reject.isPending || forceCancel.isPending;

  const close = () => {
    if (busy) return; // don't drop a mutation mid-flight
    onClose();
  };

  const ctx = update
    ? { id: update.id, phaseId: update.phaseId, projectId }
    : null;

  const onApprove = () => {
    if (!ctx) return;
    approve.mutate(
      { ...ctx, idempotencyKey: approveKey.current() },
      {
        onSuccess: () => {
          approveKey.reset();
          onClose();
        },
      },
    );
  };

  const onReject = () => {
    if (!ctx || reason.trim().length < REJECT_REASON_MIN) return;
    reject.mutate(
      { ...ctx, reason: reason.trim() },
      { onSuccess: () => onClose() },
    );
  };

  const onForceCancel = () => {
    if (!ctx || reason.trim().length < FORCE_CANCEL_REASON_MIN) return;
    forceCancel.mutate(
      {
        ...ctx,
        reason: reason.trim(),
        idempotencyKey: cancelKey.current(),
      },
      {
        onSuccess: () => {
          cancelKey.reset();
          onClose();
        },
      },
    );
  };

  // ── Decision (ب) — CVE-S4-001: reset-on-reason-change (force-cancel ONLY) ──
  // The force-cancel idempotency fingerprint the backend stores binds
  // {updateId, action:'force_cancel', reason} (updates.service.ts:602-606). So
  // editing the reason produces a DIFFERENT fingerprint under the SAME cached
  // key → the backend rejects with 422 (idempotency.service.ts:55-62). We treat
  // a reason edit as a NEW logical action and drop the cached key here, so the
  // next confirm mints a fresh one instead of 422-looping. Crucially, an
  // UNCHANGED reason fires no onChange → the key stays stable → an identical
  // retry replays idempotently (the double-click / network-retry guarantee is
  // preserved). Scoped to force-cancel deliberately: reject carries no
  // idempotency key, and approve carries no reason. The other reset boundaries
  // are owned elsewhere — the parent resets on OPEN (new update), onSuccess
  // resets after a completed action — so this handler owns only the
  // edit-after-failure boundary. MVT-5 asserts this contract on the holder.
  const onForceCancelReasonChange = (value: string) => {
    setReason(value);
    cancelKey.reset();
  };

  const actionError = approve.error || reject.error || forceCancel.error;

  return (
    <Dialog
      open={updateId !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ar ? "تفاصيل التحديث" : "Update details"}</DialogTitle>
          <DialogDescription>
            {ar
              ? "راجع التحديث ثم اتخذ الإجراء المناسب."
              : "Review the update, then take the appropriate action."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{ar ? "جارٍ التحميل…" : "Loading…"}</span>
          </div>
        )}

        {isError && !isLoading && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <p className="text-sm text-muted-foreground">
              {ar
                ? "تعذّر تحميل التحديث أو ليس لديك صلاحية عليه."
                : "Could not load this update or you lack access."}
            </p>
          </div>
        )}

        {update && !isLoading && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-foreground">{update.title}</h3>
              <Badge className={STATUS_META[update.status].cls}>
                {STATUS_META[update.status][ar ? "ar" : "en"]}
              </Badge>
            </div>

            {update.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {update.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label={ar ? "المرحلة" : "Phase"} value={update.phase.name} />
              <Field label={ar ? "مقدّم التحديث" : "Submitter"} value={update.submitter.name} />
              <Field label={ar ? "نسبة التقدم" : "Progress +"} value={`${update.progressIncrement}%`} />
              <Field label={ar ? "التكلفة" : "Cost"} value={formatMoney(update.cost, locale)} />
              <Field label={ar ? "عدد العمالة" : "Workers"} value={String(update.workersCount)} />
              <Field label={ar ? "ساعات العمل" : "Work hours"} value={update.workHours} />
            </div>

            {update.workDone && (
              <Field
                label={ar ? "العمل المنجز" : "Work done"}
                value={update.workDone}
                block
              />
            )}

            {update.status === "REJECTED" && update.rejectionReason && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm">
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {ar ? "سبب الرفض: " : "Rejection reason: "}
                </span>
                {update.rejectionReason}
              </div>
            )}

            {/* Reason input for reject / force-cancel */}
            {mode === "reject" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  {ar ? `سبب الرفض (${REJECT_REASON_MIN} أحرف على الأقل)` : `Rejection reason (min ${REJECT_REASON_MIN})`}
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  disabled={busy}
                />
              </div>
            )}

            {mode === "force-cancel" && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {ar
                      ? "الإلغاء القسري يعكس نسبة التقدم ويُنشئ تكلفة غارقة (SUNK_COST) على المشروع. لا يمكن التراجع."
                      : "Force-cancel reverses progress and books a SUNK_COST payment. This cannot be undone."}
                  </span>
                </div>
                <label className="text-xs font-semibold text-muted-foreground">
                  {ar ? `سبب الإلغاء (${FORCE_CANCEL_REASON_MIN} حرفاً على الأقل)` : `Cancel reason (min ${FORCE_CANCEL_REASON_MIN})`}
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => onForceCancelReasonChange(e.target.value)}
                  rows={3}
                  disabled={busy}
                />
              </div>
            )}

            {actionError != null && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {ar
                  ? "فشل تنفيذ الإجراء. تحقق من الحالة وحاول مجدداً."
                  : "The action failed. Check the status and try again."}
              </p>
            )}

            {/* Action bar — gated by role + current status */}
            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border/40">
              {mode === "view" && (
                <>
                  {canReview && update.status === "PENDING" && (
                    <>
                      <Button
                        variant="outline"
                        className="gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10"
                        onClick={() => {
                          setReason("");
                          setMode("reject");
                        }}
                        disabled={busy}
                      >
                        <XCircle className="w-4 h-4" />
                        {ar ? "رفض" : "Reject"}
                      </Button>
                      <Button className="gap-2" onClick={onApprove} disabled={busy}>
                        {approve.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        {ar ? "اعتماد" : "Approve"}
                      </Button>
                    </>
                  )}
                  {canForceCancel && update.status === "APPROVED" && (
                    <Button
                      variant="outline"
                      className="gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10"
                      onClick={() => {
                        setReason("");
                        setMode("force-cancel");
                      }}
                      disabled={busy}
                    >
                      <ShieldAlert className="w-4 h-4" />
                      {ar ? "إلغاء قسري" : "Force-cancel"}
                    </Button>
                  )}
                </>
              )}

              {mode === "reject" && (
                <>
                  <Button variant="ghost" onClick={() => setMode("view")} disabled={busy}>
                    {ar ? "رجوع" : "Back"}
                  </Button>
                  <Button
                    className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                    onClick={onReject}
                    disabled={busy || reason.trim().length < REJECT_REASON_MIN}
                  >
                    {reject.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {ar ? "تأكيد الرفض" : "Confirm reject"}
                  </Button>
                </>
              )}

              {mode === "force-cancel" && (
                <>
                  <Button variant="ghost" onClick={() => setMode("view")} disabled={busy}>
                    {ar ? "رجوع" : "Back"}
                  </Button>
                  <Button
                    className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                    onClick={onForceCancel}
                    disabled={busy || reason.trim().length < FORCE_CANCEL_REASON_MIN}
                  >
                    {forceCancel.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {ar ? "تأكيد الإلغاء القسري" : "Confirm force-cancel"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  block,
}: {
  label: string;
  value: string;
  block?: boolean;
}) {
  return (
    <div className={block ? "col-span-2 space-y-1" : "space-y-1"}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value}</p>
    </div>
  );
}

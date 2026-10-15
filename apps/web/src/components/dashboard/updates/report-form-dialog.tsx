"use client";
// ============================================
// ReportFormDialog — author / continue a daily report (Session A)
//
// Visual + behavioural reference is the REVIEW screen (update-detail-dialog):
// same Dialog size, same loading spinner, same error tone, same rejection
// banner, same STATUS_META badges (imported, never re-declared).
//
// ── Flaky-network contract (the reason this file has state at all) ──
// POST /phases/:id/updates takes NO Idempotency-Key, so "one logical report"
// is held together here plus the backend's duplicate guard:
//
//   1. The action buttons are disabled while a mutation is in flight, so a
//      double-tap cannot fire a second create.
//   2. `activeId` is written the MOMENT a create succeeds. Every later press
//      therefore goes to edit/submit — never to create. This is what protects
//      the case that actually happens in the field: the request landed but the
//      response was lost.
//   3. If a create still races through twice (two tabs, resumed app), the
//      backend answers 409 (updates.service.ts:224-271). That is NOT shown as
//      an error: we refetch, adopt the existing row, KEEP what the user typed,
//      and ask them to press send again.
//   4. After any failure on an existing row we ask the SERVER what the row is
//      now and branch on the returned status — never on error text, which is
//      not a stable contract.
// ============================================
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ImagePlus, Info, Loader2, Save, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdate } from "@/lib/hooks/use-update";
import { phaseUpdatesQueryOptions } from "@/lib/hooks/use-phase-updates";
import {
  useCreateUpdate,
  useEditUpdate,
  useSubmitUpdate,
} from "@/lib/hooks/use-update-actions";
import {
  EMPTY_REPORT_FORM,
  mapReportFormToBody,
  reportFormFromUpdate,
  validateReportForm,
  type ReportFormState,
} from "@/lib/updates/map-report-form-to-body";
import { STATUS_META } from "./update-detail-dialog";
import type { UpdateListItem, UpdateStatus } from "@/types/update";

type Mode = "create" | "continue" | "locked";

interface Props {
  phase: { id: string; name: string };
  projectId: string;
  userId: string | undefined;
  /** My continuable (DRAFT/REJECTED) row, resolved by the caller. */
  existing: UpdateListItem | null;
  onClose: () => void;
}

/** My newest DRAFT/REJECTED row — always continuable, no date involved. */
function findMyContinuable(items: UpdateListItem[], userId: string | undefined) {
  if (!userId) return null;
  const mine = items.filter(
    (u) =>
      u.submitter.id === userId &&
      (u.status === "DRAFT" || u.status === "REJECTED"),
  );
  return mine.length
    ? mine.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a))
    : null;
}

/** My newest PENDING, else my newest APPROVED — whatever the 409 was about. */
function findMyBlocking(items: UpdateListItem[], userId: string | undefined) {
  if (!userId) return null;
  const mine = items.filter((u) => u.submitter.id === userId);
  const pending = mine.filter((u) => u.status === "PENDING");
  const pool = pending.length
    ? pending
    : mine.filter((u) => u.status === "APPROVED");
  return pool.length
    ? pool.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a))
    : null;
}

export function ReportFormDialog({
  phase,
  projectId,
  userId,
  existing,
  onClose,
}: Props) {
  const locale = useLocale();
  const ar = locale === "ar";
  const queryClient = useQueryClient();

  // Keyed on the OPEN-TIME row only. Nothing that happens later can start this
  // fetch — in particular the 409 path must never pull server values over what
  // the user has typed. The list row omits workRemaining, hence the detail read.
  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
  } = useUpdate(existing?.id ?? "");

  const [mode, setMode] = useState<Mode>(existing ? "continue" : "create");
  const [activeId, setActiveId] = useState<string | null>(existing?.id ?? null);
  const [form, setForm] = useState<ReportFormState>(
    existing ? reportFormFromUpdate(existing) : EMPTY_REPORT_FORM,
  );
  const [prefilled, setPrefilled] = useState(!existing);
  const [dirty, setDirty] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lockedStatus, setLockedStatus] = useState<UpdateStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(
    existing?.rejectionReason ?? null,
  );

  const create = useCreateUpdate();
  const edit = useEditUpdate();
  const submit = useSubmitUpdate();
  const busy = create.isPending || edit.isPending || submit.isPending;

  // One-shot prefill from the full detail. Never overwrites user edits.
  useEffect(() => {
    if (prefilled || !detail || dirty) return;
    setForm(reportFormFromUpdate(detail));
    setRejectionReason(detail.rejectionReason);
    setPrefilled(true);
  }, [detail, prefilled, dirty]);

  const errors = validateReportForm(form);
  const hasErrors = Object.keys(errors).length > 0;

  const setField = (key: keyof ReportFormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const close = () => {
    if (busy) return; // never drop a mutation mid-flight
    onClose();
  };

  /** Re-read this phase's rows through the SAME key/fn the lists use. */
  const refetchPhase = async () => {
    const { queryKey, queryFn } = phaseUpdatesQueryOptions(phase.id, {});
    return queryClient.fetchQuery({ queryKey, queryFn, staleTime: 0 });
  };

  /**
   * `idUsed` is passed by value, not read from state: when a create succeeds
   * and the following submit fails inside the same handler, the state setter
   * has not flushed yet — reading `activeId` here would see null and take the
   * wrong branch.
   */
  const handleFailure = async (err: unknown, idUsed: string | null) => {
    const status = (err as { status?: number } | null)?.status;

    // (3) duplicate-guard: adopt the existing row, keep local values.
    if (status === 409 && idUsed === null) {
      const fresh = await refetchPhase();
      const mine = findMyContinuable(fresh.items, userId);
      if (mine) {
        setActiveId(mine.id);
        setMode("continue");
        setRejectionReason(mine.rejectionReason);
        setNotice(
          ar
            ? "تقريرك اتحفظ قبل كده — اضغط إرسال تاني"
            : "Your report was already saved — press send again",
        );
        return;
      }
      const blocking = findMyBlocking(fresh.items, userId);
      setMode("locked");
      setLockedStatus(blocking?.status ?? "PENDING");
      return;
    }

    // (4) existing row failed: ask the server what it is NOW.
    if (idUsed !== null) {
      const fresh = await refetchPhase();
      const row = fresh.items.find((u) => u.id === idUsed);
      if (row && row.status !== "DRAFT") {
        setMode("locked");
        setLockedStatus(row.status);
        return;
      }
    }
    // Otherwise transient — form, values and mode all stay as they are and the
    // backend message is rendered below.
  };

  const runSend = async () => {
    if (busy) return;
    setShowErrors(true);
    if (hasErrors) return;
    setNotice(null);

    const body = mapReportFormToBody(form);
    let id = activeId;
    try {
      if (id === null) {
        const created = await create.mutateAsync({
          phaseId: phase.id,
          projectId,
          body,
        });
        id = created.id;
        setActiveId(id); // (2) a second press can never create again
        setDirty(false);
      } else if (dirty) {
        await edit.mutateAsync({ id, phaseId: phase.id, projectId, body });
        setDirty(false);
      }
      await submit.mutateAsync({ id, phaseId: phase.id, projectId });
      onClose();
    } catch (err) {
      await handleFailure(err, id);
    }
  };

  const runSaveDraft = async () => {
    if (busy) return;
    setShowErrors(true);
    if (hasErrors) return;
    setNotice(null);

    const body = mapReportFormToBody(form);
    let id = activeId;
    try {
      if (id === null) {
        const created = await create.mutateAsync({
          phaseId: phase.id,
          projectId,
          body,
        });
        id = created.id;
        setActiveId(id);
      } else {
        await edit.mutateAsync({ id, phaseId: phase.id, projectId, body });
      }
      setDirty(false);
      // Deliberately NOT closing (BUG-A-001, found by the draft spec): on a
      // phone with a weak signal the form is the only place this text exists.
      // Closing it hides whether anything was kept and forces a re-open to
      // continue, so we confirm in place and leave every value where it is.
      setMode("continue");
      setNotice(
        ar
          ? "اتحفظت كمسودة — تقدر تكمّل تعديل أو تبعت للمراجعة"
          : "Saved as a draft — keep editing or send it for review",
      );
    } catch (err) {
      await handleFailure(err, id);
    }
  };

  const actionError = (create.error ?? edit.error ?? submit.error) as
    | { message?: string; errors?: unknown[] }
    | null
    | undefined;

  const fieldError = (key: keyof ReportFormState) =>
    showErrors && errors[key] ? (
      <p className="text-xs text-red-600 dark:text-red-400">{errors[key]}</p>
    ) : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ar ? "تقرير يومي" : "Daily report"} — {phase.name}
          </DialogTitle>
          <DialogDescription>
            {mode === "locked"
              ? ar
                ? "في تقرير قائم على المرحلة دي النهاردة."
                : "There is already a report for this phase today."
              : ar
                ? "اكتب اللي اتعمل النهاردة وابعته للمراجعة."
                : "Describe today's work and send it for review."}
          </DialogDescription>
        </DialogHeader>

        {detailLoading && !prefilled && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{ar ? "جارٍ التحميل…" : "Loading…"}</span>
          </div>
        )}

        {detailError && !prefilled && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <p className="text-sm text-muted-foreground">
              {ar
                ? "تعذّر تحميل التقرير الحالي."
                : "Could not load the current report."}
            </p>
          </div>
        )}

        {mode === "locked" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {ar ? "حالة تقرير النهاردة:" : "Today's report status:"}
              </span>
              {lockedStatus && (
                <Badge className={STATUS_META[lockedStatus].cls}>
                  {STATUS_META[lockedStatus][ar ? "ar" : "en"]}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {ar
                ? "مش ممكن تعدّله من هنا. استنى المراجعة، أو كلّم مدير المشروع."
                : "It can't be edited here. Wait for the review or talk to the project manager."}
            </p>
            <div className="flex justify-end pt-2 border-t border-border/40">
              <Button variant="outline" size="lg" onClick={close}>
                {ar ? "تمام" : "Close"}
              </Button>
            </div>
          </div>
        )}

        {mode !== "locked" && (!detailLoading || prefilled) && !detailError && (
          <div className="space-y-5">
            {notice && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}

            {rejectionReason && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm">
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {ar ? "سبب الرفض: " : "Rejection reason: "}
                </span>
                {rejectionReason}
              </div>
            )}

            {/* ── Required ── */}
            <div className="space-y-1.5">
              <Label htmlFor="report-title">
                {ar ? "عنوان التقرير" : "Report title"}{" "}
                <span className="text-red-600 dark:text-red-400">
                  * {ar ? "(مطلوب)" : "(required)"}
                </span>
              </Label>
              <Input
                id="report-title"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                disabled={busy}
                placeholder={ar ? "مثال: صبّ خرسانة الدور الأرضي" : "e.g. Ground floor concrete pour"}
              />
              {fieldError("title")}
            </div>

            {/* ── Optional ── */}
            <div className="pt-1 border-t border-border/40">
              <p className="pt-3 text-xs font-semibold text-muted-foreground">
                {ar ? "تفاصيل إضافية (اختيارية)" : "More details (optional)"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-work-done">
                {ar ? "العمل المنجز" : "Work done"}
              </Label>
              <Textarea
                id="report-work-done"
                rows={3}
                value={form.workDone}
                onChange={(e) => setField("workDone", e.target.value)}
                disabled={busy}
              />
              {fieldError("workDone")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-work-remaining">
                {ar ? "العمل المتبقي" : "Work remaining"}
              </Label>
              <Textarea
                id="report-work-remaining"
                rows={2}
                value={form.workRemaining}
                onChange={(e) => setField("workRemaining", e.target.value)}
                disabled={busy}
              />
              {fieldError("workRemaining")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-description">
                {ar ? "ملاحظات" : "Notes"}
              </Label>
              <Textarea
                id="report-description"
                rows={2}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                disabled={busy}
              />
              {fieldError("description")}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="report-workers">
                  {ar ? "عدد العمالة" : "Workers"}
                </Label>
                <Input
                  id="report-workers"
                  inputMode="numeric"
                  value={form.workersCount}
                  onChange={(e) => setField("workersCount", e.target.value)}
                  disabled={busy}
                />
                {fieldError("workersCount")}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-hours">
                  {ar ? "ساعات العمل" : "Work hours"}
                </Label>
                <Input
                  id="report-hours"
                  inputMode="decimal"
                  value={form.workHours}
                  onChange={(e) => setField("workHours", e.target.value)}
                  disabled={busy}
                />
                {fieldError("workHours")}
              </div>
            </div>

            {/* Money. type="text" + inputMode on purpose: a number input lets the
                browser normalise what was typed (1e5, locale separators, silent
                "" on partial input), and this value feeds netDue. We keep the
                exact characters and judge them with a regex instead. */}
            <div className="space-y-1.5">
              <Label htmlFor="report-cost">
                {ar
                  ? "تكلفة الأعمال المنفذة اليوم (ج.م)"
                  : "Cost of work executed today (EGP)"}
              </Label>
              <Input
                id="report-cost"
                inputMode="decimal"
                dir="ltr"
                value={form.cost}
                onChange={(e) => setField("cost", e.target.value)}
                disabled={busy}
                placeholder="0.00"
              />
              {fieldError("cost")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-progress">
                {ar ? "نسبة التقدم المضافة (%)" : "Progress added (%)"}
              </Label>
              <Input
                id="report-progress"
                inputMode="numeric"
                value={form.progressIncrement}
                onChange={(e) => setField("progressIncrement", e.target.value)}
                disabled={busy}
              />
              {fieldError("progressIncrement")}
            </div>

            {/* Photos land in Session B — a flat statement, not a dead control. */}
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
              <ImagePlus className="w-4 h-4 shrink-0" />
              <span>{ar ? "الصور — قريباً" : "Photos — coming soon"}</span>
            </div>

            {actionError != null && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p>
                    {actionError.message ??
                      (ar
                        ? "فشل تنفيذ الإجراء. تحقق من البيانات وحاول مجدداً."
                        : "The action failed. Check the data and try again.")}
                  </p>
                  {Array.isArray(actionError.errors) &&
                    actionError.errors.length > 0 && (
                      <ul className="list-disc ps-4 space-y-0.5">
                        {actionError.errors.map((e, i) => (
                          <li key={i}>{String(e)}</li>
                        ))}
                      </ul>
                    )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                variant="ghost"
                size="lg"
                onClick={close}
                disabled={busy}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={runSaveDraft}
                disabled={busy}
              >
                {(create.isPending || edit.isPending) && !submit.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {ar ? "حفظ كمسودة" : "Save draft"}
              </Button>
              <Button size="lg" className="gap-2" onClick={runSend} disabled={busy}>
                {submit.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {ar ? "إرسال للمراجعة" : "Send for review"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

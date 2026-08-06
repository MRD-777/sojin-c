"use client";
// ============================================
// PhaseAdminControls — per-phase progress override + reorder (S4, phase 8)
//
// Rendered inside the project-detail Phases list for SUPER_ADMIN /
// PROJECT_MANAGER only (UX gate — the backend @Roles guard is the real
// authority). Two actions:
//
//   • Override progress — Dialog with an integer progress (0–100) + a reason
//     (≥20, backend-enforced). PATCH /phases/:id/progress recalcs
//     project.overallProgress, so useOverridePhaseProgress invalidates the
//     project-detail query and the bars refetch server-confirmed. NO optimistic
//     write — the new % comes from the recalc, not a client guess.
//
//   • Reorder ↑/↓ — a SWAP of two `order` values. PATCH /phases/:id/reorder is
//     a plain SET of ONE phase's order (no atomic swap), and orders auto-
//     increment as consecutive ints (0,1,2…) so there is no integer slot
//     "between" two neighbours to move into. A real move therefore needs TWO
//     sets: give this phase its neighbour's order, then the neighbour this
//     phase's order. The two writes are NOT atomic — if the second fails the
//     two phases briefly share an order (an unstable tie under `orderBy: order
//     asc`) until the next reorder/reload. This is the documented limit of the
//     plan's decision Q4 (simple reorder, not drag-and-drop).
// ============================================
import { useState } from "react";
import { useLocale } from "next-intl";
import { ArrowDown, ArrowUp, Loader2, SlidersHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useOverridePhaseProgress,
  useReorderPhase,
} from "@/lib/hooks/use-phase-actions";

const OVERRIDE_REASON_MIN = 20;

/** The minimal neighbour slice a swap needs: whom to swap orders with. */
interface PhaseNeighbour {
  id: string;
  order: number;
}

interface Props {
  phase: { id: string; name: string; order: number; progress: number };
  projectId: string;
  /** Phase currently above (lower order); null if this is the first. */
  prevPhase: PhaseNeighbour | null;
  /** Phase currently below (higher order); null if this is the last. */
  nextPhase: PhaseNeighbour | null;
}

export function PhaseAdminControls({
  phase,
  projectId,
  prevPhase,
  nextPhase,
}: Props) {
  const locale = useLocale();
  const ar = locale === "ar";

  const override = useOverridePhaseProgress();
  const reorder = useReorderPhase();

  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState("");
  const [reason, setReason] = useState("");

  const reorderBusy = reorder.isPending;

  const openDialog = () => {
    setProgress(String(phase.progress));
    setReason("");
    setOpen(true);
  };

  const closeDialog = () => {
    if (override.isPending) return; // don't drop the mutation mid-flight
    setOpen(false);
  };

  const progressNum = Number(progress);
  const progressValid =
    progress.trim() !== "" &&
    Number.isInteger(progressNum) &&
    progressNum >= 0 &&
    progressNum <= 100;
  const reasonValid = reason.trim().length >= OVERRIDE_REASON_MIN;

  const onSubmitOverride = () => {
    if (!progressValid || !reasonValid) return;
    override.mutate(
      { phaseId: phase.id, projectId, progress: progressNum, reason: reason.trim() },
      { onSuccess: () => setOpen(false) },
    );
  };

  // Swap this phase's order with a neighbour's (two non-atomic sets — see the
  // file header). Neighbour orders are captured from the current render; both
  // writes use those captured values, so an interleaved refetch can't corrupt
  // the swap.
  const swapWith = (neighbour: PhaseNeighbour | null) => {
    if (!neighbour || reorderBusy) return;
    const mine = phase.order;
    reorder.mutate(
      { phaseId: phase.id, projectId, order: neighbour.order },
      {
        onSuccess: () =>
          reorder.mutate({ phaseId: neighbour.id, projectId, order: mine }),
      },
    );
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => swapWith(prevPhase)}
        disabled={!prevPhase || reorderBusy}
        title={ar ? "تحريك لأعلى" : "Move up"}
        aria-label={ar ? "تحريك لأعلى" : "Move up"}
      >
        {reorderBusy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ArrowUp className="w-3.5 h-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => swapWith(nextPhase)}
        disabled={!nextPhase || reorderBusy}
        title={ar ? "تحريك لأسفل" : "Move down"}
        aria-label={ar ? "تحريك لأسفل" : "Move down"}
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={openDialog}
        disabled={reorderBusy}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {ar ? "تعديل النسبة" : "Override"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {ar ? "تعديل نسبة الإنجاز" : "Override progress"}
            </DialogTitle>
            <DialogDescription>{phase.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {ar ? "النسبة (0–100)" : "Progress (0–100)"}
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                disabled={override.isPending}
              />
              {progress.trim() !== "" && !progressValid && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {ar
                    ? "أدخل رقماً صحيحاً بين 0 و100."
                    : "Enter a whole number between 0 and 100."}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {ar
                  ? `سبب التعديل (${OVERRIDE_REASON_MIN} حرفاً على الأقل)`
                  : `Reason (min ${OVERRIDE_REASON_MIN})`}
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                disabled={override.isPending}
              />
            </div>

            {override.error != null && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {ar
                  ? "فشل حفظ التعديل. حاول مجدداً."
                  : "Could not save the override. Try again."}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                variant="ghost"
                onClick={closeDialog}
                disabled={override.isPending}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                className="gap-2"
                onClick={onSubmitOverride}
                disabled={override.isPending || !progressValid || !reasonValid}
              >
                {override.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {ar ? "حفظ" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

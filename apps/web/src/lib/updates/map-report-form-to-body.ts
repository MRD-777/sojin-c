// ============================================
// map-report-form-to-body — pure form → write-body mapper + validator (Session A)
//
// Mirrors lib/projects/map-form-to-create-input.ts: the form holds every field
// as a string (that is what <input> gives us), while the API wants numbers and
// wants optional fields ABSENT — not "" — when unset.
//
// Every bound below is copied from the backend DTO, not invented:
//   apps/api/src/modules/updates/dto/index.ts — constants :24-31, CreateUpdateDto :38-95
//
// MONEY (`cost`): the accept/reject decision is taken on the TEXT with a regex
// and ZERO arithmetic, because this value feeds money. It lands in
// totalCompleted → netDue (apps/api/src/modules/finance/financial-summary.service.ts:9-14),
// so a silently mangled input changes what a client owes. The single numeric
// conversion happens at the wire boundary, with Number() rather than
// parseFloat(): parseFloat("12,5") returns 12.5 (silent corruption) while
// Number("12,5") returns NaN, which the regex has already rejected anyway.
// ============================================
import type { CreateUpdateBody } from "@/types/update";

/** Controlled state for the report form — all strings, straight from inputs. */
export interface ReportFormState {
  title: string;
  description: string;
  workDone: string;
  workRemaining: string;
  workersCount: string;
  workHours: string;
  cost: string;
  progressIncrement: string;
}

export const EMPTY_REPORT_FORM: ReportFormState = {
  title: "",
  description: "",
  workDone: "",
  workRemaining: "",
  workersCount: "",
  workHours: "",
  cost: "",
  progressIncrement: "",
};

export type ReportFieldErrors = Partial<Record<keyof ReportFormState, string>>;

// ── Bounds, copied from the DTO (dto/index.ts:24-31) ──
const TITLE_MIN = 5;
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;
const WORK_TEXT_MAX = 2000;
const WORKERS_MAX = 1000;
const WORK_HOURS_MAX = 24;
const PROGRESS_MAX = 100;

/**
 * `cost` shape. Two sources are folded into this one expression, deliberately:
 *   • 1-9 integer digits  ⇒ the DTO's @Max(COST_MAX = 999_999_999.99)
 *                           (dto/index.ts:31,87) — enforced by digit COUNT, so
 *                           no numeric comparison is needed.
 *   • at most 2 decimals  ⇒ the COLUMN, cost Decimal(15,2)
 *                           (apps/api/prisma/schema.prisma:205). The DTO itself
 *                           does NOT bound the scale, so Postgres would round
 *                           12500.555 → 12500.56 silently. Ticket API-DECIMAL-001
 *                           tracks fixing that server-side.
 * Changing this regex breaks BOTH bounds at once — update the two sources above.
 */
const COST_RE = /^\d{1,9}(\.\d{1,2})?$/;

/** `workHours`: scale from the column Decimal(5,2) (schema.prisma:203); the
 *  0-24 bound itself is the DTO's (@Max(24), dto/index.ts:69). */
const HOURS_RE = /^\d{1,2}(\.\d{1,2})?$/;

/** Integer fields: @IsInt on workersCount (dto:61) and progressIncrement (dto:91). */
const INT_RE = /^\d{1,4}$/;

/**
 * Field-level validation mirroring the DTO. Messages reuse the backend's own
 * Arabic wording where the DTO defines one, so the user reads the same sentence
 * the API would have returned — which matters because in production the API
 * does NOT echo validation messages back at all
 * (disableErrorMessages, apps/api/src/main.ts:90).
 */
export function validateReportForm(form: ReportFormState): ReportFieldErrors {
  const errors: ReportFieldErrors = {};

  const title = form.title.trim();
  if (title.length === 0) {
    errors.title = "عنوان التحديث مطلوب";
  } else if (title.length < TITLE_MIN) {
    errors.title = `عنوان التحديث ${TITLE_MIN} حروف على الأقل`;
  } else if (title.length > TITLE_MAX) {
    errors.title = `عنوان التحديث ${TITLE_MAX} حرف كحد أقصى`;
  }

  if (form.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `الوصف ${DESCRIPTION_MAX} حرف كحد أقصى`;
  }
  if (form.workDone.trim().length > WORK_TEXT_MAX) {
    errors.workDone = `العمل المنجز ${WORK_TEXT_MAX} حرف كحد أقصى`;
  }
  if (form.workRemaining.trim().length > WORK_TEXT_MAX) {
    errors.workRemaining = `العمل المتبقي ${WORK_TEXT_MAX} حرف كحد أقصى`;
  }

  const workers = form.workersCount.trim();
  if (workers !== "") {
    if (!INT_RE.test(workers)) {
      errors.workersCount = "عدد العمالة لازم يكون رقماً صحيحاً";
    } else if (Number(workers) > WORKERS_MAX) {
      errors.workersCount = `عدد العمالة لا يتجاوز ${WORKERS_MAX}`;
    }
  }

  const hours = form.workHours.trim();
  if (hours !== "") {
    if (!HOURS_RE.test(hours)) {
      errors.workHours = "عدد ساعات العمل لازم يكون رقماً (رقمان عشريان كحد أقصى)";
    } else if (Number(hours) > WORK_HOURS_MAX) {
      errors.workHours = `عدد ساعات العمل لا يتجاوز ${WORK_HOURS_MAX} ساعة`;
    }
  }

  const cost = form.cost.trim();
  if (cost !== "" && !COST_RE.test(cost)) {
    errors.cost =
      "التكلفة لازم تكون رقماً موجباً، رقمان عشريان كحد أقصى، بلا فواصل أو رموز";
  }

  const progress = form.progressIncrement.trim();
  if (progress !== "") {
    if (!INT_RE.test(progress)) {
      errors.progressIncrement = "نسبة التقدم لازم تكون رقماً صحيحاً";
    } else if (Number(progress) > PROGRESS_MAX) {
      errors.progressIncrement = "نسبة التقدم لا تتجاوز 100%";
    }
  }

  return errors;
}

/** True when the form carries no field-level error. */
export function isReportFormValid(form: ReportFormState): boolean {
  return Object.keys(validateReportForm(form)).length === 0;
}

/**
 * Build the write body. Optional fields are included ONLY when they hold a
 * value that passes its own rule — so an out-of-shape `cost` produces no `cost`
 * key at all rather than a 400 or, worse, a mangled amount.
 */
export function mapReportFormToBody(form: ReportFormState): CreateUpdateBody {
  const body: CreateUpdateBody = { title: form.title.trim() };

  const description = form.description.trim();
  if (description) body.description = description;

  const workDone = form.workDone.trim();
  if (workDone) body.workDone = workDone;

  const workRemaining = form.workRemaining.trim();
  if (workRemaining) body.workRemaining = workRemaining;

  const workers = form.workersCount.trim();
  if (workers && INT_RE.test(workers) && Number(workers) <= WORKERS_MAX) {
    body.workersCount = Number(workers);
  }

  const hours = form.workHours.trim();
  if (hours && HOURS_RE.test(hours) && Number(hours) <= WORK_HOURS_MAX) {
    body.workHours = Number(hours);
  }

  // The ONLY numeric conversion applied to money, and only once the text has
  // already been proven well-formed by COST_RE.
  const cost = form.cost.trim();
  if (cost && COST_RE.test(cost)) body.cost = Number(cost);

  const progress = form.progressIncrement.trim();
  if (progress && INT_RE.test(progress) && Number(progress) <= PROGRESS_MAX) {
    body.progressIncrement = Number(progress);
  }

  return body;
}

/** Prefill the form from an existing update (detail or list row). */
export function reportFormFromUpdate(update: {
  title: string;
  description: string | null;
  workDone: string | null;
  workRemaining?: string | null;
  workersCount: number;
  workHours: string;
  cost: string;
  progressIncrement: number;
}): ReportFormState {
  return {
    title: update.title,
    description: update.description ?? "",
    workDone: update.workDone ?? "",
    workRemaining: update.workRemaining ?? "",
    workersCount: String(update.workersCount),
    // workHours and cost arrive as STRINGS on the wire (Prisma Decimal →
    // JSON string). They are placed in the inputs verbatim — no reformatting,
    // no Number() round-trip, so a stored 12500.50 is edited as "12500.50".
    workHours: update.workHours,
    cost: update.cost,
    progressIncrement: String(update.progressIncrement),
  };
}

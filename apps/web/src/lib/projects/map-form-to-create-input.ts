// ============================================
// map-form-to-create-input — pure form → CreateProjectInput mapper (S3, MVT-covered)
//
// The Create wizard holds every field as a string in controlled state (that is
// what <input>/<select> give us). The backend DTO, by contrast, wants:
//   • name + clientId REQUIRED (clientId a real CLIENT uuid from the selector),
//   • everything else OPTIONAL and, crucially, ABSENT when unset — NOT "".
// An empty string would fail @IsDateString / @IsNumber / @IsEnum on the API and
// is semantically "not provided", so we strip empties here rather than send them.
// totalBudget is parsed to a number (DTO @IsNumber); a blank/NaN budget is
// dropped. type is passed through only when it is one of the three valid enum
// values, so a stale/placeholder "" can never reach the wire.
//
// Kept a PURE function (no React, no client) so it is unit-testable in isolation
// and the Create page just calls it at submit time.
// ============================================
import type { CreateProjectInput, ProjectType } from "@/types/project";

/** Controlled state held by the Create wizard for the backend-backed fields. */
export interface ProjectFormState {
  name: string;
  clientId: string;
  /** "" when unchosen, otherwise a ProjectType literal. */
  type: string;
  description: string;
  location: string;
  /** yyyy-mm-dd from <input type="date">, or "". */
  startDate: string;
  expectedEndDate: string;
  /** raw <input type="number"> string, or "". */
  totalBudget: string;
  /** "HH:mm" from <input type="time">, or "". */
  dailyUpdateDeadline: string;
}

const PROJECT_TYPES: readonly ProjectType[] = [
  "FULL_FINISHING",
  "PARTIAL_FINISHING",
  "CONSTRUCTION",
];

function isProjectType(v: string): v is ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(v);
}

/**
 * Build the POST /projects body from wizard state.
 * Required fields are always present; optional fields are included only when
 * they carry a real value (empty strings and NaN budgets are dropped).
 */
export function mapFormToCreateInput(form: ProjectFormState): CreateProjectInput {
  const input: CreateProjectInput = {
    name: form.name.trim(),
    clientId: form.clientId,
  };

  const description = form.description.trim();
  if (description) input.description = description;

  const location = form.location.trim();
  if (location) input.location = location;

  if (isProjectType(form.type)) input.type = form.type;

  if (form.startDate) input.startDate = form.startDate;
  if (form.expectedEndDate) input.expectedEndDate = form.expectedEndDate;

  if (form.totalBudget.trim() !== "") {
    const budget = Number(form.totalBudget);
    if (Number.isFinite(budget)) input.totalBudget = budget;
  }

  if (form.dailyUpdateDeadline) input.dailyUpdateDeadline = form.dailyUpdateDeadline;

  return input;
}

// ============================================
// updates-client — thin data functions over the generic `client` (S4)
//
// Same contract as projects-client: go through the GENERIC client (Bearer +
// silent refresh-on-401) and unwrap the { success, data, meta } envelope. No
// React here — the React Query hooks (Stage 4) wrap these.
//
// approve + force-cancel are money-moving and idempotent: the caller passes an
// already-generated key (from an IdempotencyKeyHolder — Stage 2) which we set
// as the `Idempotency-Key` header. We do NOT generate the key here: generating
// per-call would defeat stability across retries (the whole point of the key).
//
// Action responses: the backend returns a normalized body whose shape diverges
// from the GET selects (e.g. approve coerces workHours to a NUMBER — see
// updates.service.ts:515). UI consumers never render this body; they invalidate
// and refetch the canonical UpdateDetail / UpdateListItem queries instead. So we
// type the action returns to the minimal guaranteed shape (id + status) rather
// than re-declare the divergent normalized shape.
// ============================================
import { client } from "./client";
import { unwrap } from "./http-shared";
import type { Paginated } from "@/types/project";
import type {
  ForceCancelBody,
  PhaseUpdatesQuery,
  RejectUpdateBody,
  UpdateDetail,
  UpdateListItem,
  UpdateStatus,
} from "@/types/update";

/** Minimal, always-present slice of an action response (id + resulting status).
 *  Full data comes from the invalidated queries, not from this body. */
export interface UpdateActionResult {
  id: string;
  status: UpdateStatus;
}

/** GET /phases/:phaseId/updates — status-filtered, paginated list. */
export async function listPhaseUpdates(
  phaseId: string,
  query: PhaseUpdatesQuery = {},
): Promise<Paginated<UpdateListItem>> {
  const res = await client.get(`/phases/${phaseId}/updates`, { params: query });
  return unwrap<Paginated<UpdateListItem>>(res.data);
}

/** GET /updates/:id — full detail (phase + submitter + reviewer + media + comments). */
export async function getUpdate(id: string): Promise<UpdateDetail> {
  const res = await client.get(`/updates/${id}`);
  return unwrap<UpdateDetail>(res.data);
}

/**
 * POST /updates/:id/approve — PENDING → APPROVED (idempotent).
 * No body; the `Idempotency-Key` header is REQUIRED and must be stable across
 * retries (generated once by the caller's holder).
 */
export async function approveUpdate(
  id: string,
  idempotencyKey: string,
): Promise<UpdateActionResult> {
  const res = await client.post(`/updates/${id}/approve`, null, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return unwrap<UpdateActionResult>(res.data);
}

/** POST /updates/:id/reject — PENDING → REJECTED. reason 10–1000 (backend). */
export async function rejectUpdate(
  id: string,
  body: RejectUpdateBody,
): Promise<UpdateActionResult> {
  const res = await client.post(`/updates/${id}/reject`, body);
  return unwrap<UpdateActionResult>(res.data);
}

/**
 * POST /updates/:id/force-cancel — APPROVED → FORCE_CANCELLED (idempotent).
 * SUPER_ADMIN only. Reverses progress + creates a SUNK_COST payment, so it
 * carries BOTH the reason body (20–2000) AND a stable `Idempotency-Key`.
 */
export async function forceCancelUpdate(
  id: string,
  body: ForceCancelBody,
  idempotencyKey: string,
): Promise<UpdateActionResult> {
  const res = await client.post(`/updates/${id}/force-cancel`, body, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return unwrap<UpdateActionResult>(res.data);
}

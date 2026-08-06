// ============================================
// Update / Phase-action types — web-local (S4)
//
// Derived LITERALLY from the backend response shapes + the Prisma models
// (cross-checked against schema.prisma, NOT guessed):
//   • list item  → updates.service.ts findAll SELECT (updates.service.ts:115-133)
//   • detail     → updates.service.ts findOne INCLUDE (updates.service.ts:145-172)
//                  = ALL `Update` scalars (schema.prisma:191-232) + relations
//   • bodies     → updates/dto + phases/dto
//
// Enum string values are UPPERCASE on the wire (Prisma enums + DTOs validate the
// UPPERCASE literals). We keep web-local literal unions here, same posture as
// types/project.ts (shared-types unification is a later backlog item).
//
// Money/Decimal note: Prisma Decimal serializes to a STRING in JSON
// (Decimal.prototype.toJSON). So `cost` (Decimal 15,2) AND `workHours`
// (Decimal 5,2) both arrive as strings. Int columns (workersCount,
// progressIncrement) arrive as numbers. DateTime? columns arrive as ISO
// strings or null. `materialsUsed` is a plain JSON array (numbers stay numbers).
// ============================================

import type { UserRole } from "@/types/project";

// ─── Enum literal unions (UPPERCASE — matches the wire) ───
export type UpdateStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "FORCE_CANCELLED";

export type MediaType = "IMAGE" | "VIDEO" | "DOCUMENT";

export type CommentType = "COMMENT" | "REVIEW_REQUEST" | "CHANGE_REQUEST";

export type CommentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

// ─── Nested shapes ───
/** One row of the `materialsUsed` JSON array (plain JSON — not Decimal). */
export interface MaterialUsed {
  name: string;
  quantity: number;
  unit: string;
  cost: number;
}

/** submitter sub-select (list + detail): USER_SELECT subset with role+avatar. */
export interface UpdateUserRef {
  id: string;
  name: string;
  role: UserRole;
  avatar: string | null;
}

/** reviewer sub-select (list + detail): id+name only, nullable relation. */
export interface UpdateReviewerRef {
  id: string;
  name: string;
}

/** phase sub-select on the detail response (findOne include). */
export interface UpdatePhaseRef {
  id: string;
  name: string;
  projectId: string;
  project: {
    id: string;
    companyId: string;
    name: string;
    clientId: string;
  };
}

/** media row on the detail response (full Media model, non-deleted, order asc). */
export interface UpdateMedia {
  id: string;
  updateId: string;
  type: MediaType;
  url: string;
  thumbnailUrl: string | null;
  fileSize: number;
  originalFileSize: number;
  mimeType: string;
  caption: string | null;
  order: number;
  /** ISO datetime string. */
  uploadedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  deletionReason: string | null;
}

/** comment row on the detail response (explicit select in findOne). */
export interface UpdateComment {
  id: string;
  content: string;
  type: CommentType;
  status: CommentStatus | null;
  /** ISO datetime string. */
  createdAt: string;
  user: UpdateUserRef;
}

// ─── GET /phases/:phaseId/updates → list item (findAll SELECT) ───
// NOTE: the list SELECT is deliberately NARROWER than the detail INCLUDE — it
// omits phaseId/submittedBy/workRemaining/materialsUsed/forceCancel*/lockedAt/
// updatedAt/deletedAt. Type it to exactly what the wire returns, no more.
export interface UpdateListItem {
  id: string;
  title: string;
  description: string | null;
  workDone: string | null;
  /** Int → number. */
  workersCount: number;
  /** Decimal(5,2) → string on the wire. */
  workHours: string;
  /** Decimal(15,2) → string on the wire. */
  cost: string;
  /** Int → number. */
  progressIncrement: number;
  status: UpdateStatus;
  rejectionReason: string | null;
  isLocked: boolean;
  /** ISO datetime string or null. */
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  submitter: UpdateUserRef;
  reviewer: UpdateReviewerRef | null;
  _count: {
    media: number;
    comments: number;
  };
}

// ─── GET /updates/:id → detail (findOne INCLUDE = all Update scalars) ───
export interface UpdateDetail {
  id: string;
  phaseId: string;
  submittedBy: string;
  reviewedBy: string | null;
  title: string;
  description: string | null;
  workDone: string | null;
  workRemaining: string | null;
  /** Int → number. */
  workersCount: number;
  /** Decimal(5,2) → string on the wire. */
  workHours: string;
  materialsUsed: MaterialUsed[];
  /** Decimal(15,2) → string on the wire. */
  cost: string;
  /** Int → number. */
  progressIncrement: number;
  status: UpdateStatus;
  rejectionReason: string | null;
  forceCancelReason: string | null;
  forceCancelledBy: string | null;
  isLocked: boolean;
  /** ISO datetime string or null. */
  lockedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Always null on returned rows (softDeleteFilter) — typed for wire fidelity. */
  deletedAt: string | null;
  phase: UpdatePhaseRef;
  submitter: UpdateUserRef;
  reviewer: UpdateReviewerRef | null;
  media: UpdateMedia[];
  comments: UpdateComment[];
}

// ─── GET /phases/:phaseId/updates query params (ListUpdatesQueryDto) ───
export interface PhaseUpdatesQuery {
  page?: number;
  limit?: number;
  status?: UpdateStatus;
}

// ─── Action bodies ───
// POST /updates/:id/approve       → NO body (Idempotency-Key header only).
// POST /updates/:id/reject        → RejectUpdateBody.
// POST /updates/:id/force-cancel  → ForceCancelBody + Idempotency-Key header.

/** RejectUpdateDto — reason 10–1000, mandatory. */
export interface RejectUpdateBody {
  reason: string;
}

/** ForceCancelDto — reason 20–2000, mandatory. */
export interface ForceCancelBody {
  reason: string;
}

// ─── Phase action bodies (phases/dto) ───
/** OverrideProgressDto — progress 0–100, reason 20–2000 mandatory. */
export interface OverrideProgressBody {
  progress: number;
  reason: string;
}

/** ReorderPhaseDto — order 0–1000. */
export interface ReorderPhaseBody {
  order: number;
}

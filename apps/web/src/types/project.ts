// ============================================
// Project types — web-local (S3)
//
// Derived LITERALLY from the backend response shapes, not from the mock UI:
//   • list item  → PROJECT_SELECT + _count{phases,assignments}
//     (projects.service.ts:37-53, findAll:96-99)
//   • detail     → PROJECT_SELECT + phases[] + assignments[] + _count{payments,chatRooms}
//     (projects.service.ts:118-139)
//   • create body→ CreateProjectDto (projects/dto/index.ts:21-61)
//
// Enum string values are UPPERCASE on the wire: the Prisma enums are UPPERCASE
// and the DTOs validate the UPPERCASE literals ('DRAFT', 'FULL_FINISHING', …).
// The shared-types package uses lowercase values for a different purpose, so we
// intentionally define web-local literal unions here rather than import it
// (kept web-local per plan — shared-types unification is a later backlog item).
//
// Money/Decimal note: Prisma Decimal(15,2) serializes to a STRING in JSON
// (Decimal.prototype.toJSON), so totalBudget/budget/actualCost arrive as string.
// Int columns (overallProgress/progress/weight/order) arrive as number.
// @db.Date / DateTime columns arrive as ISO strings.
// ============================================

// ─── Enum literal unions (UPPERCASE — matches the wire) ───
export type ProjectStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export type ProjectType =
  | "FULL_FINISHING"
  | "PARTIAL_FINISHING"
  | "CONSTRUCTION";

export type PhaseStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ON_HOLD";

export type ProjectRoleInProject =
  | "SITE_ENGINEER"
  | "SUPERVISOR"
  | "ACCOUNTANT"
  | "WORKER"
  | "FOREMAN";

export type UserRole =
  | "SUPER_ADMIN"
  | "PROJECT_MANAGER"
  | "SITE_ENGINEER"
  | "SUPERVISOR"
  | "ACCOUNTANT"
  | "WORKER"
  | "CLIENT";

// ─── Shared pagination envelope (findAll return) ───
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Nested shapes ───
/** client sub-select shared by list + detail (PROJECT_SELECT.client). */
export interface ProjectClientRef {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

/** phase sub-select on the detail response only. */
export interface ProjectPhase {
  id: string;
  name: string;
  order: number;
  weight: number;
  status: PhaseStatus;
  progress: number;
  /** Decimal(15,2) → string on the wire. */
  budget: string;
  /** Decimal(15,2) → string on the wire. */
  actualCost: string;
}

/** assignment sub-select on the detail response only. */
export interface ProjectAssignment {
  id: string;
  roleInProject: ProjectRoleInProject;
  isRequiredDailyUpdate: boolean;
  /** ISO datetime string. */
  assignedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar: string | null;
  };
}

// ─── Core fields shared by list + detail (PROJECT_SELECT) ───
interface ProjectCore {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  type: ProjectType;
  status: ProjectStatus;
  /** @db.Date → ISO string or null. */
  startDate: string | null;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  /** Decimal(15,2) → string on the wire. */
  totalBudget: string;
  /** Int → number. */
  overallProgress: number;
  /** "HH:mm". */
  dailyUpdateDeadline: string;
  createdAt: string;
  updatedAt: string;
  client: ProjectClientRef;
}

// ─── GET /projects → list item ───
export interface ProjectListItem extends ProjectCore {
  _count: {
    phases: number;
    assignments: number;
  };
}

// ─── GET /projects/:id → detail ───
export interface ProjectDetail extends ProjectCore {
  phases: ProjectPhase[];
  assignments: ProjectAssignment[];
  _count: {
    payments: number;
    chatRooms: number;
  };
}

// ─── GET /projects query params (ListProjectsQueryDto) ───
export interface ProjectsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProjectStatus;
  type?: ProjectType;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ─── POST /projects body (CreateProjectDto) ───
// totalBudget is a NUMBER on input (DTO @IsNumber) — asymmetric with the
// string it comes back as on the response (Decimal serialization).
export interface CreateProjectInput {
  name: string;
  clientId: string;
  description?: string;
  location?: string;
  type?: ProjectType;
  /** ISO date string (yyyy-mm-dd acceptable — @IsDateString). */
  startDate?: string;
  expectedEndDate?: string;
  totalBudget?: number;
  /** "HH:mm". */
  dailyUpdateDeadline?: string;
}

// ─── CLIENT option for the Create form selector (USER_SELECT subset) ───
export interface ClientOption {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

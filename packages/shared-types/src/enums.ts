// ============================================
// 🏗️ Construction SaaS — Shared Enums
// All enums used across frontend and backend
// ============================================

// --- User Roles ---
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  PROJECT_MANAGER = 'project_manager',
  SITE_ENGINEER = 'site_engineer',
  SUPERVISOR = 'supervisor',
  ACCOUNTANT = 'accountant',
  WORKER = 'worker',
  CLIENT = 'client',
}

// --- Subscription ---
export enum SubscriptionPlan {
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TRIAL = 'trial',
}

// --- Project ---
export enum ProjectType {
  FULL_FINISHING = 'full_finishing',
  PARTIAL_FINISHING = 'partial_finishing',
  CONSTRUCTION = 'construction',
}

export enum ProjectStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// --- Project Assignment ---
export enum ProjectRole {
  SITE_ENGINEER = 'site_engineer',
  SUPERVISOR = 'supervisor',
  ACCOUNTANT = 'accountant',
  WORKER = 'worker',
  FOREMAN = 'foreman',
}

// --- Phase ---
export enum PhaseStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ON_HOLD = 'on_hold',
}

// --- Update (Core) ---
export enum UpdateStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FORCE_CANCELLED = 'force_cancelled',
}

// --- Media ---
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

// --- Payment ---
export enum PaymentType {
  CLIENT_PAYMENT = 'client_payment',
  EXPENSE = 'expense',
  SUNK_COST = 'sunk_cost',
}

export enum PaymentMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  OTHER = 'other',
}

// --- Notification ---
export enum NotificationType {
  UPDATE_SUBMITTED = 'update_submitted',
  UPDATE_APPROVED = 'update_approved',
  UPDATE_REJECTED = 'update_rejected',
  UPDATE_FORCE_CANCELLED = 'update_force_cancelled',
  UPDATE_EDITED_AFTER_APPROVAL = 'update_edited_after_approval',
  DEADLINE_REMINDER = 'deadline_reminder',
  DEADLINE_MISSED = 'deadline_missed',
  DEADLINE_LATE = 'deadline_late',
  PAYMENT_RECORDED = 'payment_recorded',
  PHASE_COMPLETED = 'phase_completed',
  PHASE_CANCELLED = 'phase_cancelled',
  NEW_CHAT_MESSAGE = 'new_chat_message',
  NEW_COMMENT = 'new_comment',
  CHANGE_REQUEST = 'change_request',
  REVIEW_REQUEST = 'review_request',
  SLA_BREACH = 'sla_breach',
  NEW_ASSIGNMENT = 'new_assignment',
  PROGRESS_OVERRIDE = 'progress_override',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
}

// --- Chat ---
export enum ChatRoomType {
  DIRECT = 'direct',
  GROUP = 'group',
}

export enum ChatMessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  VOICE = 'voice',
}

// --- Comment ---
export enum CommentType {
  COMMENT = 'comment',
  REVIEW_REQUEST = 'review_request',
  CHANGE_REQUEST = 'change_request',
}

export enum CommentStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

// --- SubContractor ---
export enum SubContractorStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  TERMINATED = 'terminated',
}

// --- Audit ---
export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  REJECT = 'reject',
  FORCE_CANCEL = 'force_cancel',
  PROGRESS_OVERRIDE = 'progress_override',
}

// --- Daily Update Tracker ---
export enum DailyUpdateStatus {
  PENDING = 'pending',
  SUBMITTED_ON_TIME = 'submitted_on_time',
  SUBMITTED_LATE = 'submitted_late',
  MISSED = 'missed',
}

// --- Language ---
export enum Language {
  AR = 'ar',
  EN = 'en',
}

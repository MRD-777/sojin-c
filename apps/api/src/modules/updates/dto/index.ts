// ============================================
// 📝 Update DTOs — tightened per skill 04 §"Validation Rules"
// (Session 2026-05-30, Phase 6 / BUG-UPD-008).
// ============================================
import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsArray,
  IsEnum,
  ArrayMaxSize,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { UpdateStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

// Field bounds, single source of truth (kept in sync with skill 04).
// If you change one, search this file for the constant rather than the
// magic number — the same bound appears on Create + Edit + EditApproved.
const TITLE_MIN = 5;
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;
const WORK_TEXT_MAX = 2000;
const WORKERS_MAX = 1000;
const WORK_HOURS_MAX = 24;
const MATERIALS_MAX_ITEMS = 50;
const COST_MAX = 999_999_999.99;
const REJECT_REASON_MIN = 10;
const REJECT_REASON_MAX = 1000;
const FORCE_CANCEL_REASON_MIN = 20;
const FORCE_CANCEL_REASON_MAX = 2000;
const CHANGE_REASON_MIN = 20;
const CHANGE_REASON_MAX = 1000;

export class CreateUpdateDto {
  @IsString({ message: 'عنوان التحديث مطلوب' })
  @MinLength(TITLE_MIN, { message: `عنوان التحديث ${TITLE_MIN} حروف على الأقل` })
  @MaxLength(TITLE_MAX)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WORK_TEXT_MAX)
  workDone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WORK_TEXT_MAX)
  workRemaining?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(WORKERS_MAX)
  workersCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(WORK_HOURS_MAX, { message: `عدد ساعات العمل لا يتجاوز ${WORK_HOURS_MAX} ساعة` })
  workHours?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MATERIALS_MAX_ITEMS, {
    message: `لا يمكن إضافة أكثر من ${MATERIALS_MAX_ITEMS} مادة في تحديث واحد`,
  })
  materialsUsed?: Array<{
    name: string;
    quantity: number;
    unit: string;
    cost: number;
  }>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(COST_MAX)
  cost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100, { message: 'نسبة التقدم لا تتجاوز 100%' })
  progressIncrement?: number;
}

export class EditUpdateDto {
  // Optional everywhere (PATCH semantics), but when present the bounds
  // still apply — a user can't downgrade title to 2 chars.
  @IsOptional()
  @IsString()
  @MinLength(TITLE_MIN, { message: `عنوان التحديث ${TITLE_MIN} حروف على الأقل` })
  @MaxLength(TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WORK_TEXT_MAX)
  workDone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WORK_TEXT_MAX)
  workRemaining?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(WORKERS_MAX)
  workersCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(WORK_HOURS_MAX, { message: `عدد ساعات العمل لا يتجاوز ${WORK_HOURS_MAX} ساعة` })
  workHours?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MATERIALS_MAX_ITEMS, {
    message: `لا يمكن إضافة أكثر من ${MATERIALS_MAX_ITEMS} مادة في تحديث واحد`,
  })
  materialsUsed?: Array<{
    name: string;
    quantity: number;
    unit: string;
    cost: number;
  }>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(COST_MAX)
  cost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressIncrement?: number;
}

export class RejectUpdateDto {
  @IsString({ message: 'سبب الرفض مطلوب' })
  @MinLength(REJECT_REASON_MIN, {
    message: `سبب الرفض ${REJECT_REASON_MIN} حروف على الأقل`,
  })
  @MaxLength(REJECT_REASON_MAX)
  reason: string;
}

export class ForceCancelDto {
  @IsString({ message: 'سبب الإلغاء القسري مطلوب' })
  @MinLength(FORCE_CANCEL_REASON_MIN, {
    message: `سبب الإلغاء القسري ${FORCE_CANCEL_REASON_MIN} حرفاً على الأقل`,
  })
  @MaxLength(FORCE_CANCEL_REASON_MAX)
  reason: string;
}

/**
 * D3=A (Session 2026-05-30): money-moving fields (cost, progressIncrement,
 * materialsUsed) are LOCKED after approval. This DTO intentionally drops
 * them — `forbidNonWhitelisted: true` in the global ValidationPipe makes
 * sending any of them a 400. To change a money-moving field after
 * approval, force-cancel the update and create a new one.
 *
 * Deliberately NOT extending EditUpdateDto for the same reason.
 *
 * `changeReason` is REQUIRED (skill 04 §11): no anonymous edits after
 * approval. 20-1000 chars enforced by Phase 6 (BUG-UPD-008).
 */
export class EditApprovedDto {
  @IsOptional()
  @IsString()
  @MinLength(TITLE_MIN, { message: `عنوان التحديث ${TITLE_MIN} حروف على الأقل` })
  @MaxLength(TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WORK_TEXT_MAX)
  workDone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WORK_TEXT_MAX)
  workRemaining?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(WORKERS_MAX)
  workersCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(WORK_HOURS_MAX, { message: `عدد ساعات العمل لا يتجاوز ${WORK_HOURS_MAX} ساعة` })
  workHours?: number;

  @IsString({ message: 'سبب التعديل مطلوب' })
  @MinLength(CHANGE_REASON_MIN, {
    message: `سبب التعديل ${CHANGE_REASON_MIN} حرفاً على الأقل`,
  })
  @MaxLength(CHANGE_REASON_MAX)
  changeReason: string;
}

export class ListUpdatesQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(UpdateStatus, { message: 'حالة التحديث غير صالحة' })
  status?: UpdateStatus;
}

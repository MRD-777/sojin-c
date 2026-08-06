// ============================================
// 💵 Finance DTOs — S7 (financial settings + BOQ)
//
// Validation posture (skill 01 §Validation, skill 06 §Arabic messages):
//   1. Money arrives as `number` (JSON) and is converted to Prisma.Decimal
//      inside the service — same pattern as CreatePaymentDto.amount.
//      Never trust the client with more than 2 decimal places.
//   2. Percentages are bounded 0–100 at the DTO layer; the DB column is
//      DECIMAL(5,2) which would happily accept 999.99 — the DTO is the gate.
//   3. The global ValidationPipe runs with `forbidNonWhitelisted: true`,
//      so any extra property is a 400 (mass-assignment defense). Do NOT
//      add pass-through fields here.
// ============================================
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsUUID,
  IsDateString,
  Matches,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

// Field bounds — single source of truth for this module.
// MONEY_MAX matches CreatePaymentDto/CreateUpdateDto (999,999,999.99) and sits
// well inside the DB column DECIMAL(15,2).
const MONEY_MAX = 999_999_999.99;
const PCT_MIN = 0;
const PCT_MAX = 100;
const WARRANTY_MONTHS_MAX = 120;
const BOQ_NAME_MIN = 1;
const BOQ_NAME_MAX = 200;
const DELETE_REASON_MAX = 2000;
/**
 * [CVE-S7-001] `order` maps to a Postgres INTEGER (INT4). Without an upper
 * bound any value above 2,147,483,647 passes validation and dies in the
 * driver as an unhandled 500 instead of a clean 400. Every other numeric
 * field in this module was bounded; this one was not.
 */
const ORDER_MAX = 1_000_000;
/** [CVE-S7-002] At least one non-whitespace character — " " is not a name. */
const NOT_ONLY_WHITESPACE = /\S/;

/**
 * PATCH /projects/:projectId/financial-settings
 *
 * Every field is optional (partial update / upsert). The service derives
 * `oldValues` for the audit log from the ACTUAL current row (or the documented
 * defaults when no row exists) — never from this DTO (lesson: CVE-TEST-016).
 */
export class UpdateFinancialSettingsDto {
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'قيمة العقد يجب أن تكون رقماً بحد أقصى منزلتين عشريتين' },
  )
  @Min(0, { message: 'قيمة العقد لا يمكن أن تكون سالبة' })
  @Max(MONEY_MAX, { message: 'قيمة العقد تتجاوز الحد المسموح' })
  contractValue?: number;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'نسبة الاحتجاز يجب أن تكون رقماً بحد أقصى منزلتين عشريتين' },
  )
  @Min(PCT_MIN, { message: 'نسبة الاحتجاز لا يمكن أن تكون سالبة' })
  @Max(PCT_MAX, { message: 'نسبة الاحتجاز لا يمكن أن تتجاوز 100%' })
  retentionPct?: number;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'قيمة السلفة يجب أن تكون رقماً بحد أقصى منزلتين عشريتين' },
  )
  @Min(0, { message: 'قيمة السلفة لا يمكن أن تكون سالبة' })
  @Max(MONEY_MAX, { message: 'قيمة السلفة تتجاوز الحد المسموح' })
  advanceAmount?: number;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'نسبة استرداد السلفة يجب أن تكون رقماً بحد أقصى منزلتين عشريتين' },
  )
  @Min(PCT_MIN, { message: 'نسبة استرداد السلفة لا يمكن أن تكون سالبة' })
  @Max(PCT_MAX, { message: 'نسبة استرداد السلفة لا يمكن أن تتجاوز 100%' })
  advancePct?: number;

  @IsOptional()
  @IsInt({ message: 'مدة الضمان يجب أن تكون عدداً صحيحاً بالشهور' })
  @Min(0, { message: 'مدة الضمان لا يمكن أن تكون سالبة' })
  @Max(WARRANTY_MONTHS_MAX, {
    message: `مدة الضمان لا يمكن أن تتجاوز ${WARRANTY_MONTHS_MAX} شهراً`,
  })
  warrantyMonths?: number;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ بداية الضمان غير صالح' })
  warrantyStartDate?: string;
}

/** POST /projects/:projectId/boq  و  POST /boq/:id/sub-items */
export class CreateBOQItemDto {
  @IsString({ message: 'اسم البند مطلوب' })
  @MinLength(BOQ_NAME_MIN, { message: 'اسم البند مطلوب' })
  @MaxLength(BOQ_NAME_MAX, {
    message: `اسم البند لا يتجاوز ${BOQ_NAME_MAX} حرف`,
  })
  @Matches(NOT_ONLY_WHITESPACE, { message: 'اسم البند مطلوب' })
  name: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'قيمة البند يجب أن تكون رقماً بحد أقصى منزلتين عشريتين' },
  )
  @Min(0, { message: 'قيمة البند لا يمكن أن تكون سالبة' })
  @Max(MONEY_MAX, { message: 'قيمة البند تتجاوز الحد المسموح' })
  contractValue: number;

  @IsOptional()
  @IsInt({ message: 'ترتيب البند يجب أن يكون عدداً صحيحاً' })
  @Min(0, { message: 'ترتيب البند لا يمكن أن يكون سالباً' })
  @Max(ORDER_MAX, { message: 'ترتيب البند يتجاوز الحد المسموح' })
  order?: number;
}

/** PATCH /boq/:id */
export class UpdateBOQItemDto {
  @IsOptional()
  @IsString({ message: 'اسم البند غير صالح' })
  @MinLength(BOQ_NAME_MIN, { message: 'اسم البند مطلوب' })
  @MaxLength(BOQ_NAME_MAX, {
    message: `اسم البند لا يتجاوز ${BOQ_NAME_MAX} حرف`,
  })
  @Matches(NOT_ONLY_WHITESPACE, { message: 'اسم البند مطلوب' })
  name?: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'قيمة البند يجب أن تكون رقماً بحد أقصى منزلتين عشريتين' },
  )
  @Min(0, { message: 'قيمة البند لا يمكن أن تكون سالبة' })
  @Max(MONEY_MAX, { message: 'قيمة البند تتجاوز الحد المسموح' })
  contractValue?: number;

  @IsOptional()
  @IsInt({ message: 'ترتيب البند يجب أن يكون عدداً صحيحاً' })
  @Min(0, { message: 'ترتيب البند لا يمكن أن يكون سالباً' })
  @Max(ORDER_MAX, { message: 'ترتيب البند يتجاوز الحد المسموح' })
  order?: number;
}

/**
 * PATCH /boq/:id/link-update
 * The service still verifies that the update is APPROVED and belongs to the
 * SAME project (update → phase → project) — a valid UUID proves nothing.
 */
export class LinkUpdateDto {
  @IsUUID('4', { message: 'معرّف التقرير غير صالح' })
  updateId: string;
}

/**
 * DELETE /boq/:id body.
 * Unlike DeletePaymentDto, the reason is OPTIONAL here: a BOQ item is a
 * planning artifact, not a cash movement (plan decision #3). The AUDIT entry
 * is still mandatory — optional reason ≠ optional audit.
 */
export class DeleteBOQItemDto {
  @IsOptional()
  @IsString({ message: 'سبب الحذف غير صالح' })
  @MaxLength(DELETE_REASON_MAX, {
    message: `سبب الحذف يتجاوز ${DELETE_REASON_MAX} حرف`,
  })
  reason?: string;
}

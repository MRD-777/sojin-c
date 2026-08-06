// ============================================
// 📋 Project DTOs — Strict Validation
// ============================================
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Min,
  Matches,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto';

// ─── Create Project ─────────────────────────
export class CreateProjectDto {
  @IsString({ message: 'اسم المشروع مطلوب' })
  @MaxLength(300, { message: 'اسم المشروع لا يتجاوز 300 حرف' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsEnum(['FULL_FINISHING', 'PARTIAL_FINISHING', 'CONSTRUCTION'], {
    message: 'نوع المشروع غير صالح',
  })
  type?: string;

  @IsUUID('4', { message: 'معرّف العميل غير صالح' })
  clientId: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ البدء غير صحيح' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ الانتهاء المتوقع غير صحيح' })
  expectedEndDate?: string;

  @IsOptional()
  @IsNumber({}, { message: 'الميزانية يجب أن تكون رقماً' })
  @Min(0, { message: 'الميزانية لا يمكن أن تكون سالبة' })
  totalBudget?: number;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'موعد التحديث اليومي: HH:mm' })
  dailyUpdateDeadline?: string;
}

// ─── Update Project ─────────────────────────
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsEnum(['FULL_FINISHING', 'PARTIAL_FINISHING', 'CONSTRUCTION'])
  type?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalBudget?: number;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  dailyUpdateDeadline?: string;
}

// ─── Change Status ──────────────────────────
export class ChangeProjectStatusDto {
  @IsEnum(['DRAFT', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'], {
    message: 'حالة المشروع غير صالحة',
  })
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ─── Assign Member ──────────────────────────
export class AssignMemberDto {
  @IsUUID('4', { message: 'معرّف المستخدم غير صالح' })
  userId: string;

  @IsEnum(['SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER', 'FOREMAN'], {
    message: 'الدور في المشروع غير صالح',
  })
  roleInProject: string;

  @IsOptional()
  @IsBoolean()
  isRequiredDailyUpdate?: boolean;
}

// ─── Remove Member ──────────────────────────
export class RemoveMemberDto {
  @IsString()
  @IsNotEmpty({ message: 'سبب الإزالة مطلوب' })
  @MinLength(20, { message: 'سبب الإزالة يجب أن يكون 20 حرف على الأقل' })
  @MaxLength(2000)
  reason: string;
}

// ─── Soft Delete Project ────────────────────
export class DeleteProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'سبب الحذف مطلوب' })
  @MinLength(20, { message: 'سبب حذف المشروع يجب أن يكون 20 حرف على الأقل' })
  @MaxLength(2000)
  reason: string;
}

// ─── List Query ─────────────────────────────
export class ListProjectsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsEnum(['FULL_FINISHING', 'PARTIAL_FINISHING', 'CONSTRUCTION'])
  type?: string;
}

// ============================================
// 👤 User DTOs — Strict Validation
// ============================================
import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsBoolean,
  IsArray,
  IsIn,
  MaxLength,
  MinLength,
  Matches,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto';

/**
 * Columns the client is allowed to sort users by (A6).
 *
 * The base PaginationDto accepts any string for `sortBy`, which would let an
 * attacker order by `supabaseAuthId` and use the resulting page-by-page diff
 * as an ordering oracle — leaking otherwise-private identifiers. We restrict
 * to columns whose values are already exposed in USER_SELECT and that have
 * legitimate UI sort use cases.
 */
const USER_SORT_COLUMNS = [
  'name',
  'email',
  'role',
  'createdAt',
  'lastLogin',
] as const;

// ─── Create (Invite) User ───────────────────
export class CreateUserDto {
  @IsString({ message: 'الاسم مطلوب' })
  @MinLength(2, { message: 'الاسم يجب أن يكون حرفين على الأقل' })
  @MaxLength(200, { message: 'الاسم لا يتجاوز 200 حرف' })
  name: string;

  @IsEmail({}, { message: 'البريد الإلكتروني غير صحيح' })
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s-]{8,20}$/, { message: 'رقم الهاتف غير صحيح' })
  phone?: string;

  @IsString()
  @IsEnum(
    ['SUPER_ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER', 'CLIENT'],
    { message: 'الدور غير صالح' },
  )
  role: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialty?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
  @MaxLength(100)
  password?: string;
}

// ─── Update User ────────────────────────────
// ⚠️ Whitelisted fields ONLY. Adding role / companyId / supabaseAuthId here
// would be a mass-assignment vulnerability — those go through dedicated flows.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'الاسم يجب أن يكون حرفين على الأقل' })
  @MaxLength(200, { message: 'الاسم لا يتجاوز 200 حرف' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s-]{8,20}$/, { message: 'رقم الهاتف غير صحيح' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  avatar?: string;

  @IsOptional()
  @IsEnum(['AR', 'EN'])
  preferredLanguage?: string;
}

// ─── Soft Delete User ───────────────────────
export class DeleteUserDto {
  @IsString()
  @MinLength(20, { message: 'سبب حذف المستخدم يجب أن يكون 20 حرف على الأقل' })
  @MaxLength(2000)
  reason: string;
}

// ─── Update My Profile ──────────────────────
export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s-]{8,20}$/, { message: 'رقم الهاتف غير صحيح' })
  phone?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  notificationPreferences?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(['AR', 'EN'], { message: 'اللغة يجب أن تكون AR أو EN' })
  preferredLanguage?: string;
}

// ─── Change Role ────────────────────────────
export class ChangeRoleDto {
  @IsString()
  @IsEnum(
    ['SUPER_ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER', 'CLIENT'],
    { message: 'الدور غير صالح' },
  )
  role: string;
}

// ─── Update Permissions ─────────────────────
export class UpdatePermissionsDto {
  @IsArray({ message: 'الصلاحيات يجب أن تكون قائمة' })
  @IsString({ each: true, message: 'كل صلاحية يجب أن تكون نص' })
  permissions: string[];
}

// ─── List Users Query ───────────────────────
export class ListUsersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(
    ['SUPER_ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER', 'CLIENT'],
    { message: 'فلتر الدور غير صالح' },
  )
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Restrict `sortBy` to a known set of columns (A6 — ordering oracle defense).
   * The base PaginationDto declares this as `@IsString()`. The override here
   * narrows the value space without breaking the default (createdAt).
   */
  @IsOptional()
  @IsIn(USER_SORT_COLUMNS, {
    message: `حقل الفرز يجب أن يكون أحد: ${USER_SORT_COLUMNS.join(', ')}`,
  })
  declare sortBy?: string;
}

// ============================================
// 🏢 Company DTOs
//
// ⚠️ STRICT WHITELIST.
// Fields explicitly NOT accepted here (mass-assignment protection):
//   - subscriptionPlan / subscriptionStatus → only the billing webhook
//     (PaddleWebhookController) may change these. Allowing them here
//     would let any SUPER_ADMIN upgrade their own plan for free.
//   - storageQuota / storageUsed → derived from plan + media operations.
//   - slug → immutable for URL stability and SEO continuity.
//   - createdAt / updatedAt / deletedAt → managed by Prisma.
//   - id → primary key.
// Global ValidationPipe is configured with `forbidNonWhitelisted: true`,
// so any client sending those keys gets a 400. This DTO documents the
// contract; the pipe enforces it.
// ============================================
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'اسم الشركة يجب أن يكون حرفين على الأقل' })
  @MaxLength(200, { message: 'اسم الشركة لا يتجاوز 200 حرف' })
  name?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['https'] },
    { message: 'رابط الشعار يجب أن يكون HTTPS صحيح' },
  )
  @MaxLength(1000)
  logo?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s-]{8,20}$/, { message: 'رقم الهاتف غير صحيح' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صحيح' })
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'العنوان لا يتجاوز 500 حرف' })
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  commercialRegister?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialization?: string;

  // ISO 4217 currency codes are 3 chars; we accept up to 10 for tolerance
  // (e.g. "EGP", "SAR", "USD"). Service normalizes to upper-case.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3,10}$/i, { message: 'رمز العملة غير صحيح' })
  currency?: string;

  // IANA timezone strings — validated by length here, the JS Intl API
  // validates the actual zone at write time (defensive).
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}

export class UpdateCompanySettingsDto {
  @IsObject({ message: 'الإعدادات يجب أن تكون كائناً' })
  settings: Record<string, unknown>;
}

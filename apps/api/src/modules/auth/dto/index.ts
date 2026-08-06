// ============================================
// Auth DTOs — Proper validation with class-validator
// Multi-layer input validation
// ============================================
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * Register Company DTO
 * Validates all fields for company + admin creation
 */
export class RegisterCompanyDto {
  @IsString({ message: 'اسم الشركة يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم الشركة مطلوب' })
  @MinLength(2, { message: 'اسم الشركة يجب أن يكون على الأقل حرفين' })
  @MaxLength(100, { message: 'اسم الشركة يجب ألا يتجاوز 100 حرف' })
  companyName: string;

  @IsEmail({}, { message: 'بريد الشركة غير صالح' })
  @IsNotEmpty({ message: 'بريد الشركة مطلوب' })
  companyEmail: string;

  @IsString({ message: 'هاتف الشركة يجب أن يكون نصاً' })
  @IsOptional()
  @Matches(/^[+]?[\d\s\-()]{8,20}$/, {
    message: 'رقم الهاتف غير صالح',
  })
  companyPhone?: string;

  @IsString({ message: 'اسم المسؤول يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم المسؤول مطلوب' })
  @MinLength(2, { message: 'اسم المسؤول يجب أن يكون على الأقل حرفين' })
  @MaxLength(100, { message: 'اسم المسؤول يجب ألا يتجاوز 100 حرف' })
  adminName: string;

  @IsEmail({}, { message: 'بريد المسؤول غير صالح' })
  @IsNotEmpty({ message: 'بريد المسؤول مطلوب' })
  adminEmail: string;

  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @MinLength(10, { message: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل' })
  @MaxLength(128, { message: 'كلمة المرور يجب ألا تتجاوز 128 حرف' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+-=[\]{};':"\\|,.<>/?])/,
    {
      message: 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص',
    },
  )
  adminPassword: string;
}

/**
 * Login DTO
 */
export class LoginDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  email: string;

  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  password: string;
}

/**
 * Refresh Token DTO
 */
export class RefreshTokenDto {
  @IsString({ message: 'رمز التحديث يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'رمز التحديث مطلوب' })
  refreshToken: string;
}

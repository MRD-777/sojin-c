// ============================================
// 🔧 Phase DTOs
// ============================================
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  IsDateString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';

export class CreatePhaseDto {
  @IsString({ message: 'اسم المرحلة مطلوب' })
  @MaxLength(300)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'وزن المرحلة يجب أن يكون 1 على الأقل' })
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;
}

export class UpdatePhaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsEnum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'])
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;
}

export class OverrideProgressDto {
  @IsInt({ message: 'نسبة الإنجاز يجب أن تكون رقماً صحيحاً' })
  @Min(0, { message: 'نسبة الإنجاز لا يمكن أن تكون سالبة' })
  @Max(100, { message: 'نسبة الإنجاز لا تتجاوز 100%' })
  progress: number;

  @IsString({ message: 'سبب التعديل مطلوب' })
  @IsNotEmpty({ message: 'سبب التعديل مطلوب' })
  @MinLength(20, { message: 'سبب التعديل يجب أن يكون 20 حرف على الأقل' })
  @MaxLength(2000)
  reason: string;
}

export class ReorderPhaseDto {
  @IsInt()
  @Min(0)
  @Max(1000, { message: 'الترتيب يتجاوز الحد المسموح' })
  order: number;
}

export class DeletePhaseDto {
  @IsString()
  @IsNotEmpty({ message: 'سبب حذف المرحلة مطلوب' })
  @MinLength(20, { message: 'سبب حذف المرحلة يجب أن يكون 20 حرف على الأقل' })
  @MaxLength(2000)
  reason: string;
}

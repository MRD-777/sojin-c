// ============================================
// 💰 Payment DTOs
// ============================================
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto';
import { PaymentType, PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'المبلغ يجب أن يكون رقماً بحد أقصى منزلتين عشريتين' },
  )
  @Min(0.01, { message: 'المبلغ يجب أن يكون أكبر من صفر' })
  @Max(999_999_999.99, { message: 'المبلغ يتجاوز الحد المسموح' })
  amount: number;

  // ⚠️ Use the Prisma enum directly so DTO and DB stay in sync.
  @IsEnum(PaymentType, { message: 'نوع الدفع غير صالح' })
  type: PaymentType;

  @IsEnum(PaymentMethod, { message: 'طريقة الدفع غير صالحة' })
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'الوصف يتجاوز 1000 حرف' })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptUrl?: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ الدفع غير صالح' })
  date?: string;
}

/**
 * DELETE /payments/:id body.
 * Reason is MANDATORY for financial soft-deletes — it lands in the audit log
 * and is required for legal/audit defensibility.
 */
export class DeletePaymentDto {
  @IsString({ message: 'سبب الحذف مطلوب' })
  @IsNotEmpty({ message: 'سبب الحذف مطلوب' })
  @MinLength(20, { message: 'سبب الحذف يجب أن يكون 20 حرف على الأقل' })
  @MaxLength(2000, { message: 'سبب الحذف يتجاوز 2000 حرف' })
  reason: string;
}

export class ListPaymentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
}

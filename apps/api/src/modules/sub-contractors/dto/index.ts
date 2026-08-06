// ============================================
// 🏗️ Sub-Contractor DTOs
// ============================================
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  MaxLength,
  Min,
  Matches,
  IsEmail,
} from 'class-validator';

/** Create a company-level subcontractor */
export class CreateSubContractorDto {
  @IsString({ message: 'اسم مقاول الباطن مطلوب' })
  @MaxLength(300)
  name: string;

  @IsString({ message: 'التخصص مطلوب' })
  @MaxLength(500)
  specialty: string;

  @IsString({ message: 'رقم الهاتف مطلوب' })
  @Matches(/^\+?[\d\s-]{8,20}$/, { message: 'رقم الهاتف غير صحيح' })
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صحيح' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** Update a company-level subcontractor */
export class UpdateSubContractorDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialty?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s-]{8,20}$/)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** Assign a subcontractor to a phase */
export class AssignToPhaseDto {
  @IsUUID('4', { message: 'معرّف مقاول الباطن غير صالح' })
  subContractorId: string;

  @IsOptional()
  @IsNumber({}, { message: 'التكلفة المتفق عليها يجب أن تكون رقم' })
  @Min(0)
  agreedCost?: number;
}

/** Update a phase-subcontractor assignment */
export class UpdatePhaseAssignmentDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  agreedCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCost?: number;

  @IsOptional()
  @IsEnum(['ACTIVE', 'COMPLETED', 'TERMINATED'], {
    message: 'حالة العقد غير صالحة',
  })
  status?: string;
}

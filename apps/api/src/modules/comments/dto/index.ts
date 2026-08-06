// ============================================
// 💬 Comment DTOs
// ============================================
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCommentDto {
  @IsString({ message: 'نص التعليق مطلوب' })
  @MinLength(1, { message: 'التعليق لا يمكن أن يكون فارغاً' })
  @MaxLength(5000, { message: 'التعليق لا يتجاوز 5000 حرف' })
  content: string;

  @IsOptional()
  @IsEnum(['COMMENT', 'REVIEW_REQUEST', 'CHANGE_REQUEST'], {
    message: 'نوع التعليق غير صالح',
  })
  type?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرّف التعليق الأصلي غير صالح' })
  parentId?: string;
}

export class EditCommentDto {
  @IsString({ message: 'نص التعليق مطلوب' })
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

export class ResolveCommentDto {
  @IsEnum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED'], { message: 'الحالة غير صالحة' })
  status: string;
}

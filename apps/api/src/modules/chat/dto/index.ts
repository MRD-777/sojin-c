// ============================================
// 🗨️ Chat DTOs
// ============================================
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto';

export class CreateChatRoomDto {
  @IsString({ message: 'اسم الغرفة مطلوب' })
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsEnum(['DIRECT', 'GROUP'], {
    message: 'نوع الغرفة غير صالح',
  })
  type?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  participantIds?: string[];
}

export class SendMessageDto {
  @IsString({ message: 'نص الرسالة مطلوب' })
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'FILE', 'VOICE'], {
    message: 'نوع الرسالة غير صالح',
  })
  type?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}

export class ListMessagesQueryDto extends PaginationDto {}

import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsStringOrArrayOfStrings } from 'src/infrastructure/validators';

class ToDto {
  @IsOptional()
  @IsString()
  sms?: string;

  @IsOptional()
  @IsStringOrArrayOfStrings()
  email?: string | string[];

  @IsOptional()
  @IsString()
  whatsapp?: string;

  [key: string]: any;
}

class AttachmentDto {
  @IsString()
  base64: string;

  @IsString()
  filename: string;

  @IsString()
  filetype: string;
}

class DataDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  attachment?: AttachmentDto;

  [key: string]: any;
}

export class BatchDto {
  @ValidateNested()
  @Type(() => ToDto)
  to: ToDto;

  @ValidateNested()
  @Type(() => DataDto)
  data: DataDto;
}

export class NotificationRequestDto {
  @IsString()
  event: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchDto)
  batch: BatchDto[];
}

export class NotificationResponseDto {
  @IsString()
  status?: string;

  @IsString()
  request_id?: string;

  @IsString()
  received_time?: string;

  @IsString()
  automation_name?: string;

  @IsString()
  automation_link_id?: string;

  @IsString()
  message?: string;

  @IsString()
  journey?: boolean;

  @IsString()
  notificationId: string;
}

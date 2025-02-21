import {
  IsString,
  IsOptional,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CallbackProviderTypeEnum } from '../enums';
import { IsValidEnum } from 'src/infrastructure/validators';

export class CallbackQueryParamsDto {
  @IsValidEnum(CallbackProviderTypeEnum)
  provider: CallbackProviderTypeEnum;
}

export class NotificationCallbackRequestDto {
  @IsString()
  requestId: string;

  @IsString()
  notificationId: string;

  @IsString()
  clientId: string;

  @IsString()
  clientType: string;

  @IsString()
  event: string;

  @IsString()
  template: string;

  @IsString()
  recipient: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsString()
  sentTime: string;

  @IsString()
  channel: string;

  @IsString()
  provider: string;

  @IsString()
  messageId: string;

  @IsString()
  integrationAccountName: string;
}

export class NotificationCallbackResponseDto {
  @IsNumber()
  statusCode: number;

  @IsString()
  message: string;
}

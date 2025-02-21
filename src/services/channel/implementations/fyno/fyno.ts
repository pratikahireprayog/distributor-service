// Library imports
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map } from 'rxjs';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';

// Module files imports
import { BaseChannel } from '../../channel.abstract';
import { FynoConfig } from './fyno.config';
import {
  FynoRequestDto,
  BatchDto as FynoBatchDto,
  FynoResponseDto,
} from './fyno.dto';

// Other imports
import { ChannelTypeEnum } from 'src/common/enums';
import {
  NotificationRequestDto,
  BatchDto as NotificationBatchDto,
} from 'src/common/dtos/notification.dto';
import { NotificationSecretsRepository } from 'src/common/repositories';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { AxiosError } from 'axios';

@Injectable()
export class FynoChannel implements BaseChannel {
  private fynoConfig;
  type = ChannelTypeEnum.FYNO;
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: Logger,
    private readonly notificationSecretsRepository: NotificationSecretsRepository,
  ) {}

  async sendNotification(
    user,
    notificationId: string,
    notificationRequest: NotificationRequestDto,
  ) {
    // Implementation for sending notification via Fyno
    this.logger.log(`Sending notification via Fyno}`);
    this.fynoConfig = await FynoConfig.create(
      user.vendorCode,
      this.notificationSecretsRepository,
    );
    const headers = this.buildHeaders();
    const payload: FynoRequestDto = this.buildPayload(
      user,
      notificationId,
      notificationRequest,
    );
    this.logger.log(`Fyno Payload: ${JSON.stringify(payload)}`);
    const response: FynoResponseDto = await this.callFynoEventAPI(
      payload,
      headers,
    );
    this.logger.log(`Fyno Response: ${JSON.stringify(response)}`);
    return response;
  }

  private buildHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.fynoConfig.fynoApiKey}`,
    };
  }

  private buildPayload(
    user,
    notificationId: string,
    notificationRequest: NotificationRequestDto,
  ): FynoRequestDto {
    const fynoBatch: FynoBatchDto[] = notificationRequest.batch.map((element) =>
      this.addCallbackData(user, notificationId, element),
    );
    return { ...notificationRequest, batch: fynoBatch } as FynoRequestDto;
  }

  private addCallbackData(
    user,
    notificationId: string,
    element: NotificationBatchDto,
  ): FynoBatchDto {
    return {
      to: element.to,
      data: {
        ...element.data,
      },
      callback: {
        allowlist_url: [this.fynoConfig.fynoCallbackURLName],
        custom_id: notificationId,
        custom1: user.vendorCode,
        custom2: user.vendorType,
        enable: true,
      },
    };
  }

  private async callFynoEventAPI(
    payload: FynoRequestDto,
    headers: any,
  ): Promise<FynoResponseDto> {
    return firstValueFrom(
      this.httpService
        .post(this.fynoConfig.fynoEventAPI, payload, { headers })
        .pipe(
          map((response) => {
            const responseData = response.data;
            responseData.notificationId = payload.batch[0].callback.custom_id;
            return responseData;
          }),
          catchError((error: AxiosError) => {
            this.logger.error('Fyno event API error:', error);
            const errorData = error.response?.data as { _message?: string };
            throw new CustomHttpException(
              error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
              errorData?._message || 'Event API error',
              error.response?.data,
            );
          }),
        ),
    );
  }
}

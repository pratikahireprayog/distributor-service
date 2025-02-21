import {
  Controller,
  Post,
  Request,
  Logger,
  Get,
  Body,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { NotificationCallbackService } from './notification-callback.service';
import { CallbackProviderTypeEnum } from 'src/common/enums';
import { NotificationCallbackRequestDto } from 'src/common/dtos/notification-callback.dto';
import { EnumValidationPipe } from 'src/infrastructure/validators';

@Controller()
export class NotificationCallbackController {
  constructor(
    private readonly notificationCallbackService: NotificationCallbackService,
    private readonly logger: Logger,
  ) {}

  // @UseGuards(RoleGuard)
  @Post('callback')
  @HttpCode(HttpStatus.ACCEPTED)
  processCallback(
    @Request() req,
    @Body() notificationCallbackRequest: NotificationCallbackRequestDto,
    @Query('provider', new EnumValidationPipe(CallbackProviderTypeEnum))
    provider: CallbackProviderTypeEnum,
  ) {
    this.logger.log(
      `Provider : ${provider}\n Notification Callback request: ${notificationCallbackRequest}`,
    );
    return this.notificationCallbackService.processCallback(
      notificationCallbackRequest,
    );
  }

  // @Get('get-notification-logs')
  // getNotification() {
  //   this.logger.log(`In Get Notification Logs Request.`);
  //   return this.notificationCallbackService.getNotification();
  // }
}

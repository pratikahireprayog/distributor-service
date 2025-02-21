import {
  Controller,
  Post,
  UseGuards,
  Request,
  Logger,
  Get,
  Body,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  NotificationRequestDto,
  NotificationResponseDto,
} from '../../common/dtos/notification.dto';
import { AuthGuardRole } from 'src/common/authentication/auth.guard';

@Controller()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly logger: Logger,
  ) {}

  @Post('notify')
  @UseGuards(AuthGuardRole)
  async notify(
    @Request() req,
    @Body() notificationRequest: NotificationRequestDto,
  ): Promise<NotificationResponseDto> {
    this.logger.log(
      `--- Notification request | endpoint: '/notify' --- \n
      user: ${JSON.stringify(req.user)} \n
      payload: ${JSON.stringify(notificationRequest)}`,
    );
    return await this.notificationService.notify(req.user, notificationRequest);
  }

  @Get('get-notification')
  getNotification() {
    this.logger.log(`In Get Notification request.`);
    return this.notificationService.getNotification();
  }
}

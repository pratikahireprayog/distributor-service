import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NotificationLogRepository } from 'src/common/repositories/notification-log/notification-log.repository';
import {
  NotificationCallbackRequestDto,
  NotificationCallbackResponseDto,
} from 'src/common/dtos/notification-callback.dto';

// @Injectable()
// export class NotificationCallbackManager {
//   private channels: Map<ChannelTypeEnum, BaseChannel> = new Map();
//   private currentChannel: BaseChannel;

//   constructor(private readonly channelFactory: ChannelFactory) {}

//   addChannel(channelType: ChannelTypeEnum): void {
//     if (!this.channels.has(channelType)) {
//       const channel = this.channelFactory.createChannel(channelType);
//       this.channels.set(channelType, channel);
//     }
//   }

//   setCurrentChannel(channelType: ChannelTypeEnum): void {
//     if (!this.channels.has(channelType)) {
//       this.addChannel(channelType);
//     }
//     this.currentChannel = this.channels.get(channelType);
//   }

//   async sendNotification(
//     notificationId: string,
//     notification: any,
//   ): Promise<NotificationResponseDto> {
//     if (!this.currentChannel) {
//       throw new Error('No channel selected');
//     }
//     return await this.currentChannel.sendNotification(
//       notificationId,
//       notification,
//     );
//   }

//   async sendNotificationThroughChannel(
//     channelType: ChannelTypeEnum,
//     notificationId: string,
//     notification: any,
//   ): Promise<NotificationResponseDto> {
//     if (!this.channels.has(channelType)) {
//       this.addChannel(channelType);
//     }
//     const channel = this.channels.get(channelType);
//     return await channel.sendNotification(notificationId, notification);
//   }
// }

@Injectable()
export class NotificationCallbackService {
  constructor(
    private readonly notificationLogRepository: NotificationLogRepository,
    private readonly logger: Logger,
  ) {
    this.logger.log('NotificationCallbackService initialized');
  }

  async processCallback(
    notificationCallbackRequest: NotificationCallbackRequestDto,
  ): Promise<NotificationCallbackResponseDto> {
    this.logger.log('Processing callback request');
    this.logger.debug('Callback request details:', notificationCallbackRequest);

    await this.saveNotificationCallback(notificationCallbackRequest);

    this.logger.log('Callback request processed successfully');
    return {
      statusCode: HttpStatus.ACCEPTED,
      message: 'Request received successfully',
    };
  }

  async saveNotificationCallback(
    notificationCallbackRequest: NotificationCallbackRequestDto,
  ) {
    this.logger.log('Saving notification callback');
    try {
      const insertedNotificationLog =
        await this.notificationLogRepository.create(
          notificationCallbackRequest,
        );
      this.logger.log('Notification callback saved successfully');
      this.logger.log(`Inserted ID: ${insertedNotificationLog._id}`);
    } catch (error) {
      this.logger.error('Error saving notification callback:', error);
      throw error;
    }
  }
}

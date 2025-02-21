import { Injectable, Logger } from '@nestjs/common';

import { IDGenerationService } from '../id-generation/id-generation.service';
import { NotificationRepository } from 'src/common/repositories/notification/notification.repository';
import { NotificationModel } from 'src/common/repositories';
import {
  NotificationRequestDto,
  NotificationResponseDto,
} from 'src/common/dtos/notification.dto';
import { ChannelTypeEnum } from 'src/common/enums';
import {
  BaseChannel,
  ChannelFactory,
  FYNO_ENV_CONST,
} from 'src/services/channel/';

@Injectable()
export class NotificationManager {
  private channels: Map<ChannelTypeEnum, BaseChannel> = new Map();
  private currentChannel: BaseChannel;

  constructor(
    private readonly channelFactory: ChannelFactory,
    private readonly logger: Logger,
  ) {
    this.logger.log('NotificationManager initialized');
  }

  addChannel(channelType: ChannelTypeEnum): void {
    if (!this.channels.has(channelType)) {
      this.logger.log(`Adding new channel: ${channelType}`);
      const channel = this.channelFactory.createChannel(channelType);
      this.channels.set(channelType, channel);
      this.logger.log(`Channel ${channelType} added successfully`);
    } else {
      this.logger.log(`Channel ${channelType} already exists`);
    }
  }

  setCurrentChannel(channelType: ChannelTypeEnum): void {
    this.logger.log(`Setting current channel to: ${channelType}`);
    if (!this.channels.has(channelType)) {
      this.logger.log(`Channel ${channelType} not found, adding it`);
      this.addChannel(channelType);
    }
    this.currentChannel = this.channels.get(channelType);
    this.logger.log(`Current channel set to: ${channelType}`);
  }

  async sendNotification(
    user,
    notificationId: string,
    notification: NotificationRequestDto,
  ): Promise<NotificationResponseDto> {
    this.logger.log(`Sending notification through current channel`);
    this.logger.log(`Notification details: ID: ${notificationId}`);

    if (!this.currentChannel) {
      this.logger.error('No channel selected');
      throw new Error('No channel selected');
    }

    const response = await this.currentChannel.sendNotification(
      user,
      notificationId,
      notification,
    );

    this.logger.log(
      `Notification sent successfully, Response: ${JSON.stringify(response)}`,
    );

    return response;
  }

  async sendNotificationThroughChannel(
    user,
    channelType: ChannelTypeEnum,
    notificationId: string,
    notification: any,
  ): Promise<NotificationResponseDto> {
    this.logger.log(`Sending notification through channel: ${channelType}`);
    if (!this.channels.has(channelType)) {
      this.logger.log(`Channel ${channelType} not found, adding it`);
      this.addChannel(channelType);
    }
    const channel = this.channels.get(channelType);
    this.logger.log(
      `Notification details: ID: ${notificationId}, User: ${JSON.stringify(user)}, Channel: ${channelType}`,
    );
    const response = await channel.sendNotification(
      user,
      notificationId,
      notification,
    );
    this.logger.log(
      `Notification sent successfully through ${channelType}, Response: ${JSON.stringify(response)}`,
    );
    return response;
  }
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly idGenerationService: IDGenerationService,
    private readonly notificationManager: NotificationManager,
    private readonly notificationRepository: NotificationRepository,
    private readonly logger: Logger,
  ) {
    this.logger.log('NotificationService initialized');
  }

  async notify(
    user,
    notificationRequest: NotificationRequestDto,
  ): Promise<NotificationResponseDto> {
    this.logger.log(`In notify method`);

    this.notificationManager.addChannel(ChannelTypeEnum.FYNO);
    this.notificationManager.setCurrentChannel(ChannelTypeEnum.FYNO);
    const notificationId = await this.idGenerationService.generateID();

    this.logger.log(`Generated Notification Id: ${notificationId}`);

    await this.saveNotificationRequest(
      user,
      notificationId,
      notificationRequest,
    );

    const response = await this.notificationManager.sendNotification(
      user,
      notificationId,
      notificationRequest,
    );

    this.logger.log(`Notification sent, Response: ${JSON.stringify(response)}`);
    this.logger.log(
      `--- End ofNotification request | endpoint: '/notify' --- `,
    );
    return response;
  }

  async saveNotificationRequest(
    user,
    notificationId: string,
    notificationRequest: NotificationRequestDto,
  ) {
    this.logger.log(`In saveNotificationRequest method`);

    const notificationBody: NotificationModel = {
      notificationId: notificationId,
      clientId: user.vendorCode,
      clientType: user.vendorType,
      callbackURL: [process.env[FYNO_ENV_CONST.FYNO_CALLBACK_URL_NAME] ?? ''],
      createdAt: new Date(),
      event: notificationRequest.event,
      batch: notificationRequest.batch,
    };
    const insertedNotification =
      await this.notificationRepository.create(notificationBody);
    this.logger.log(
      `Notification request saved successfully with id: ${insertedNotification._id}`,
    );
  }

  async getNotification(): Promise<NotificationModel> {
    this.logger.log('In getNotification method');
    const notification = await this.notificationRepository.getOne({});
    this.logger.log('Notification data: ', notification);
    return notification;
  }
}

// Notification Response

// Login Fails
// {
//   "status_code": 401,
//   "message": "Please login to access this resource."
// }
//   "status_code": 401,
//   "message": "Please login to access this resource."
// }

// Notification Request

// {
//   "event" : "synoverge_payment_confirmation",
//   "batch" : [
//       {
//           "data" : {
//               "paymentAmount" : 57848.0,
//               "paymentDate" : "2024-07-20"
//           },
//           "to" : {
//               "whatsapp" : "6290895270"
//           }
//       }
//   ],
//   "callbackURL" : [
//       "QaNotificationLog"
//   ],
//   "createdAt" : "1721473913787",
//   "clientId" : "syno",
//   "clientType" : "SELLER"
// }

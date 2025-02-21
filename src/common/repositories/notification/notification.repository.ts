import { Injectable, Inject } from '@nestjs/common';
import { Model } from 'mongoose';
import { NotificationDocument } from './notification.schema';
import { REPOSITORY_MODEL_PROVIDER_CONST } from 'src/common/constants';
import { BaseMongoRepository } from 'src/common/abstracts/database.abstract';

@Injectable()
export class NotificationRepository extends BaseMongoRepository<NotificationDocument> {
  constructor(
    @Inject(REPOSITORY_MODEL_PROVIDER_CONST.NOTIFICATION_MODEL)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {
    super(notificationModel);
  }
}

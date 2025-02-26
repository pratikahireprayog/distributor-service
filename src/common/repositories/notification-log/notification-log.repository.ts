import { Injectable, Inject } from '@nestjs/common';
import { Model } from 'mongoose';
import { NotificationLogDocument } from './notification-log.schema';
import { REPOSITORY_MODEL_PROVIDER_CONST } from 'src/common/constants';
import { BaseMongoRepository } from 'src/common/abstracts/database.abstract';

// @Injectable()
// export class NotificationLogRepository extends BaseMongoRepository<NotificationLogDocument> {
//   constructor(
//     @Inject(REPOSITORY_MODEL_PROVIDER_CONST.NOTIFICATION_LOG_MODEL)
//     private readonly notificationLogModel: Model<NotificationLogDocument>,
//   ) {
//     super(notificationLogModel);
//   }
// }

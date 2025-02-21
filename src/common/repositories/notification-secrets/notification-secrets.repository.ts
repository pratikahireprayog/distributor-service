import { Injectable, Inject } from '@nestjs/common';
import { Model } from 'mongoose';
import { NotificationSecretsDocument } from './notification-secrets.schema';
import { REPOSITORY_MODEL_PROVIDER_CONST } from 'src/common/constants';
import { BaseMongoRepository } from 'src/common/abstracts/database.abstract';

@Injectable()
export class NotificationSecretsRepository extends BaseMongoRepository<NotificationSecretsDocument> {
  constructor(
    @Inject(REPOSITORY_MODEL_PROVIDER_CONST.NOTIFICATION_SECRETS_MODEL)
    private readonly notificationSecretsModel: Model<NotificationSecretsDocument>,
  ) {
    super(notificationSecretsModel);
  }
}

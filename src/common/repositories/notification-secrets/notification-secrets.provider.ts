// notification.provider.ts
import { Provider } from '@nestjs/common';
import { Connection } from 'mongoose';
import { NotificationSecretsSchema } from './notification-secrets.schema';
import {
  DATABASE_NAME_CONST,
  REPOSITORY_MODEL_CONST,
  REPOSITORY_MODEL_PROVIDER_CONST,
} from 'src/common/constants';

export const notificationSecretsProviders: Provider[] = [
  {
    provide: REPOSITORY_MODEL_PROVIDER_CONST.NOTIFICATION_SECRETS_MODEL,
    useFactory: (connection: Connection) =>
      connection.model(
        REPOSITORY_MODEL_CONST.NOTIFICATION_SECRETS_MODEL,
        NotificationSecretsSchema,
      ),
    inject: [DATABASE_NAME_CONST.FULFILLMENT],
  },
];

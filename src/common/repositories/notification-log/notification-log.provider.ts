// notification.provider.ts
import { Provider } from '@nestjs/common';
import { Connection } from 'mongoose';
import { NotificationLogSchema } from './notification-log.schema';
import {
  DATABASE_NAME_CONST,
  REPOSITORY_MODEL_CONST,
  REPOSITORY_MODEL_PROVIDER_CONST,
} from 'src/common/constants';

export const notificationLogProviders: Provider[] = [
  {
    provide: REPOSITORY_MODEL_PROVIDER_CONST.NOTIFICATION_LOG_MODEL,
    useFactory: (connection: Connection) =>
      connection.model(
        REPOSITORY_MODEL_CONST.NOTIFICATION_LOG_MODEL,
        NotificationLogSchema,
      ),
    inject: [DATABASE_NAME_CONST.FULFILLMENT],
  },
];

// notification.provider.ts
import { Provider } from '@nestjs/common';
import { Connection } from 'mongoose';
import { NotificationSchema } from './notification.schema';
import {
  DATABASE_NAME_CONST,
  REPOSITORY_MODEL_CONST,
  REPOSITORY_MODEL_PROVIDER_CONST,
} from 'src/common/constants';

export const notificationProviders: Provider[] = [
  {
    provide: REPOSITORY_MODEL_PROVIDER_CONST.NOTIFICATION_MODEL,
    useFactory: (connection: Connection) =>
      connection.model(
        REPOSITORY_MODEL_CONST.NOTIFICATION_MODEL,
        NotificationSchema,
      ),
    inject: [DATABASE_NAME_CONST.FULFILLMENT],
  },
];

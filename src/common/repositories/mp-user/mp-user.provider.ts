import { Connection } from 'mongoose';
import { MPUserSchema } from './mp-user.schema';
import {
  DATABASE_NAME_CONST,
  REPOSITORY_MODEL_CONST,
  REPOSITORY_MODEL_PROVIDER_CONST,
} from 'src/common/constants';
import { Provider } from '@nestjs/common';

export const mpUserProvider: Provider[] = [
  {
    provide: REPOSITORY_MODEL_PROVIDER_CONST.MP_USER_MODEL,
    useFactory: (connection: Connection) =>
      connection.model(REPOSITORY_MODEL_CONST.MP_USER_MODEL, MPUserSchema),
    inject: [DATABASE_NAME_CONST.FULFILLMENT_DB],
  },
];

import { Provider } from '@nestjs/common';
import { Connection } from 'mongoose';
import { StatusTrackingLogsSchema } from './status-tracking-logs.schema';
import {
    DATABASE_NAME_CONST,
    REPOSITORY_MODEL_CONST,
    REPOSITORY_MODEL_PROVIDER_CONST,
} from 'src/common/constants';

export const statusTrackingLogsProviders: Provider[] = [
    {
        provide: REPOSITORY_MODEL_PROVIDER_CONST.STATUS_TRACKING_LOGS_MODEL,
        useFactory: (connection: Connection) =>
            connection.model(
                REPOSITORY_MODEL_CONST.STATUS_TRACKING_LOGS_MODEL,
                StatusTrackingLogsSchema,
            ),
        inject: [DATABASE_NAME_CONST.FULFILLMENT_DB],
    },
]; 
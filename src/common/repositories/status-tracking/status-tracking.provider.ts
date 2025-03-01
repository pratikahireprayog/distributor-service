import { Provider } from '@nestjs/common';
import { Connection } from 'mongoose';
import { StatusTrackingSchema } from './status-tracking.schema';
import {
    DATABASE_NAME_CONST,
    REPOSITORY_MODEL_CONST,
    REPOSITORY_MODEL_PROVIDER_CONST,
} from 'src/common/constants';

export const statusTrackingProviders: Provider[] = [
    {
        provide: REPOSITORY_MODEL_PROVIDER_CONST.STATUS_TRACKING_MODEL,
        useFactory: (connection: Connection) =>
            connection.model(
                REPOSITORY_MODEL_CONST.STATUS_TRACKING_MODEL,
                StatusTrackingSchema,
            ),
        inject: [DATABASE_NAME_CONST.FULFILLMENT_DB],
    },
]; 
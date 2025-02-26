import { Model } from 'mongoose';
import { Injectable, Inject } from '@nestjs/common';
import { StatusTrackingLogsDocument } from './status-tracking-logs.schema';
import { BaseMongoRepository } from 'src/common/abstracts/database.abstract';
import { REPOSITORY_MODEL_PROVIDER_CONST } from 'src/common/constants';

@Injectable()
export class StatusTrackingLogsRepository extends BaseMongoRepository<StatusTrackingLogsDocument> {
    constructor(
        @Inject(REPOSITORY_MODEL_PROVIDER_CONST.STATUS_TRACKING_LOGS_MODEL)
        private readonly statusTrackingLogsModel: Model<StatusTrackingLogsDocument>
    ) {
        super(statusTrackingLogsModel);
    }
} 
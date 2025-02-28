import { Model } from 'mongoose';
import { Injectable, Inject } from '@nestjs/common';
import { StatusTrackingDocument } from './status-tracking.schema';
import { BaseMongoRepository } from 'src/common/abstracts/database.abstract';
import { REPOSITORY_MODEL_PROVIDER_CONST } from 'src/common/constants';

@Injectable()
export class StatusTrackingRepository extends BaseMongoRepository<StatusTrackingDocument> {
    constructor(
        @Inject(REPOSITORY_MODEL_PROVIDER_CONST.STATUS_TRACKING_MODEL)
        private readonly statusTrackingModel: Model<StatusTrackingDocument>
    ) {
        super(statusTrackingModel);
    }
} 
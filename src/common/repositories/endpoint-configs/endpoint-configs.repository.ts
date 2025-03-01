import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMongoRepository } from 'src/common/repositories/base/database.abstract';
import { EndpointConfigDocument, EndpointConfigModel } from './endpoint-configs.schema';
import { REPOSITORY_MODEL_PROVIDER_CONST } from 'src/common/constants';

@Injectable()
export class EndpointConfigRepository extends BaseMongoRepository<EndpointConfigDocument> {
    constructor(
        @Inject(REPOSITORY_MODEL_PROVIDER_CONST.ENDPOINT_CONFIG_MODEL)
        private readonly endpointConfigModel: Model<EndpointConfigDocument>,
    ) {
        super(endpointConfigModel);
    }
} 
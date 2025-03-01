import { Model } from 'mongoose';
import { Inject } from '@nestjs/common';
import { DeliveryAgentDocument } from './delivery-agent.schema';
import { REPOSITORY_MODEL_PROVIDER_CONST } from 'src/common/constants';
import { BaseMongoRepository } from 'src/common/repositories/base/database.abstract';

export class DeliveryAgentRepository extends BaseMongoRepository<DeliveryAgentDocument> {
  constructor(
    @Inject(REPOSITORY_MODEL_PROVIDER_CONST.DELIVERY_AGENT_MODEL)
    private readonly deliveryAgentModel: Model<DeliveryAgentDocument>,
  ) {
    super(deliveryAgentModel);
  }
}

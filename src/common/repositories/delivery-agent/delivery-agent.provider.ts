import { Connection } from 'mongoose';
import { DeliveryAgentSchema } from './delivery-agent.schema';
import {
  DATABASE_NAME_CONST,
  REPOSITORY_MODEL_CONST,
  REPOSITORY_MODEL_PROVIDER_CONST,
} from 'src/common/constants';
import { Provider } from '@nestjs/common';

export const deliveryAgentProvider: Provider[] = [
  {
    provide: REPOSITORY_MODEL_PROVIDER_CONST.DELIVERY_AGENT_MODEL,
    useFactory: async (connection: Connection) => {
      await connection.asPromise();
      // Disable buffering to fail fast instead of timing out
      DeliveryAgentSchema.set('bufferCommands', false);
      return connection.model(
        REPOSITORY_MODEL_CONST.DELIVERY_AGENT_MODEL,
        DeliveryAgentSchema,
      );
    },
    inject: [DATABASE_NAME_CONST.FULFILLMENT_DB],
  },
];

import { Connection } from "mongoose";
import { OrderPartnerSchema } from "./order-partner.schema";
import {
  DATABASE_NAME_CONST,
  REPOSITORY_MODEL_CONST,
  REPOSITORY_MODEL_PROVIDER_CONST,
} from "src/common/constants";
import { Provider } from "@nestjs/common";

export const orderPartnerProvider: Provider[] = [
  {
    provide: REPOSITORY_MODEL_PROVIDER_CONST.ORDER_PARTNER_MODEL,
    useFactory: async (connection: Connection) => {
      await connection.asPromise();
      // Disable buffering to fail fast instead of timing out
      OrderPartnerSchema.set('bufferCommands', false);
      return connection.model(
        REPOSITORY_MODEL_CONST.ORDER_PARTNER_MODEL,
        OrderPartnerSchema
      );
    },
    inject: [DATABASE_NAME_CONST.DISTRIBUTOR_DB],
  },
];

import { Connection } from "mongoose";
import { OrderPartnerHistorySchema } from "./order-partner-history.schema";
import {
  DATABASE_NAME_CONST,
  REPOSITORY_MODEL_CONST,
  REPOSITORY_MODEL_PROVIDER_CONST,
} from "src/common/constants";
import { Provider } from "@nestjs/common";

export const orderPartnerHistoryProvider: Provider[] = [
  {
    provide: REPOSITORY_MODEL_PROVIDER_CONST.ORDER_PARTNER_HISTORY_MODEL,
    useFactory: async (connection: Connection) => {
      await connection.asPromise();
      // Disable buffering to fail fast instead of timing out
      OrderPartnerHistorySchema.set('bufferCommands', false);
      return connection.model(
        REPOSITORY_MODEL_CONST.ORDER_PARTNER_HISTORY_MODEL,
        OrderPartnerHistorySchema
      );
    },
    inject: [DATABASE_NAME_CONST.DISTRIBUTOR_DB],
  },
];

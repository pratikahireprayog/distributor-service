import { Connection } from "mongoose";
import { AwbSeriesAuditSchema } from "./awb-series-audit.schema";
import {
  DATABASE_NAME_CONST,
  REPOSITORY_MODEL_CONST,
  REPOSITORY_MODEL_PROVIDER_CONST,
} from "src/common/constants";
import { Provider } from "@nestjs/common";

export const awbSeriesAuditProvider: Provider[] = [
  {
    provide: REPOSITORY_MODEL_PROVIDER_CONST.AWB_SERIES_AUDIT_MODEL,
    useFactory: async (connection: Connection) => {
      await connection.asPromise();
      // Disable buffering to fail fast instead of timing out
      AwbSeriesAuditSchema.set('bufferCommands', false);
      return connection.model(
        REPOSITORY_MODEL_CONST.AWB_SERIES_AUDIT_MODEL,
        AwbSeriesAuditSchema
      );
    },
    inject: [DATABASE_NAME_CONST.DISTRIBUTOR_DB],
  },
];

import { Connection } from "mongoose";
import { REPOSITORY_MODEL_PROVIDER_CONST } from "src/common/constants";
import { EndpointConfigSchema } from "./endpoint-configs.schema";
import { DATABASE_NAME_CONST, REPOSITORY_MODEL_CONST } from "src/common/constants";
import { Provider } from "@nestjs/common";

export const endpointConfigProviders: Provider[] = [
    {
        provide: REPOSITORY_MODEL_PROVIDER_CONST.ENDPOINT_CONFIG_MODEL,
        useFactory: async (connection: Connection) => {
            await connection.asPromise();
            return connection.model(
                REPOSITORY_MODEL_CONST.ENDPOINT_CONFIG_MODEL,
                EndpointConfigSchema,
            );
        },
        inject: [DATABASE_NAME_CONST.DISTRIBUTOR_DB],
    },
]; 
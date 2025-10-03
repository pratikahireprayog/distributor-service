import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

import { UrbanBoltService } from "./urbanbolt.service";
import { UrbanBoltAuthService } from "./urbanbolt-auth.service";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SchemaMapperModule } from "src/infrastructure/schema-mapper/schema-mapper.module";

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds timeout for UrbanBolt API
      maxRedirects: 5,
    }),
    ConfigModule,
    EndpointConfigModule,
    SchemaMapperModule,
  ],
  providers: [UrbanBoltService, UrbanBoltAuthService],
  exports: [UrbanBoltService, UrbanBoltAuthService],
})
export class UrbanBoltModule { }

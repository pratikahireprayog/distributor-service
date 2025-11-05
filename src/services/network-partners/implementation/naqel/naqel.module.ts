import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

import { NAQELService } from "./naqel.service";
import { NAQELAuthService } from "./naqel.auth.service";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SchemaMapperModule } from "src/infrastructure/schema-mapper/schema-mapper.module";

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    ConfigModule,
    EndpointConfigModule,
    SchemaMapperModule,
  ],
  providers: [NAQELService, NAQELAuthService],
  exports: [NAQELService, NAQELAuthService],
})
export class NAQELModule { } 
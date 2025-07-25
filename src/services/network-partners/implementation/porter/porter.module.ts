import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

import { PorterService } from "./porter.service";
import { PorterAuthService } from "./porter.auth-service";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    EndpointConfigModule,
  ],
  providers: [
    PorterService,
    PorterAuthService,
    SchemaMapperService,
  ],
  exports: [
    PorterService,
    PorterAuthService,
  ],
})
export class PorterModule {}

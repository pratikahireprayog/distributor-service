import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

import { IndiaPostInternationalService } from "./india-post-international.service";
import { IndiaPostInternationalAuthService } from "./india-post-international.auth-service";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    EndpointConfigModule,
  ],
  providers: [
    IndiaPostInternationalService,
    IndiaPostInternationalAuthService,
    SchemaMapperService,
  ],
  exports: [
    IndiaPostInternationalService,
    IndiaPostInternationalAuthService,
  ],
})
export class IndiaPostInternationalModule {}



import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { IndiaPostDomesticService } from "./india-post-domestic.service";
import { IndiaPostDomesticAuthService } from "./india-post-domestic-auth.service";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";

/**
 * Module for India Post Domestic DoP Integration network partner implementation
 */
@Module({
  imports: [HttpModule, ConfigModule, EndpointConfigModule],
  providers: [
    IndiaPostDomesticService,
    IndiaPostDomesticAuthService,
    SchemaMapperService,
  ],
  exports: [IndiaPostDomesticService, IndiaPostDomesticAuthService],
})
export class IndiaPostDomesticModule {}

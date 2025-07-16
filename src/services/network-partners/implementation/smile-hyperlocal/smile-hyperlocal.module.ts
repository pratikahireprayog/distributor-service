import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SmileHyperlocalService } from "./smile-hyperlocal.service";
import { SmileHyperlocalAuthService } from "./smile-hyperlocal-auth.service";
import { SchemaMapperModule } from "src/infrastructure/schema-mapper/schema-mapper.module";

@Module({
  imports: [HttpModule, ConfigModule, EndpointConfigModule, SchemaMapperModule],
  providers: [SmileHyperlocalService, SmileHyperlocalAuthService],
  exports: [SmileHyperlocalService, SmileHyperlocalAuthService],
})
export class SmileHyperlocalModule {} 
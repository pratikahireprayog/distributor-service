import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { BaralService } from "./baral.service";

@Module({
  imports: [HttpModule, ConfigModule, EndpointConfigModule],
  providers: [BaralService, SchemaMapperService],
  exports: [BaralService],
})
export class BaralModule {}



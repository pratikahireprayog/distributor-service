import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { DelhiveryService } from "./delhivery.service";
import { DelhiveryAuthService } from "./delhivery-auth.service";
import { DelhiveryController } from "./delhivery.controller";

/**
 * Delhivery module for LTL operations
 */
@Module({
  imports: [HttpModule, ConfigModule, EndpointConfigModule],
  controllers: [DelhiveryController],
  providers: [DelhiveryService, DelhiveryAuthService, SchemaMapperService],
  exports: [DelhiveryService, DelhiveryAuthService],
})
export class DelhiveryModule {}

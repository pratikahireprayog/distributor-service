import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { EkartService } from "./ekart.service";
import { EkartAuthService } from "./ekart-auth.service";
import { EkartController } from "./ekart.controller";
import { DatabaseModule } from "src/infrastructure/database/database.module";

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
    EndpointConfigModule,
    DatabaseModule,
  ],
  controllers: [EkartController],
  providers: [EkartService, EkartAuthService, SchemaMapperService],
  exports: [EkartService, EkartAuthService],
})
export class EkartModule {}

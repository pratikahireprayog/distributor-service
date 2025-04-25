import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

import { ShipyaariService } from "./shipyaari.service";
import { ShipyaariAuthService } from "./shipyaari-auth.service";
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
  providers: [ShipyaariService, ShipyaariAuthService],
  exports: [ShipyaariService, ShipyaariAuthService],
})
export class ShipyaariModule {}

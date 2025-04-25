import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

import { ShipyaariService } from "./shipyaari.service";
import { ShipyaariAuthService } from "./shipyaari-auth.service";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    ConfigModule,
    EndpointConfigModule,
  ],
  providers: [ShipyaariService, ShipyaariAuthService],
  exports: [ShipyaariService],
})
export class ShipyaariModule {}

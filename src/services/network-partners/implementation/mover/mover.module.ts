import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

import { MoverService } from "./mover.service";
import { MoverAuthService } from "./mover-auth.service";
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
  providers: [MoverAuthService, MoverService],
  exports: [MoverService, MoverAuthService],
})
export class MoverModule {}


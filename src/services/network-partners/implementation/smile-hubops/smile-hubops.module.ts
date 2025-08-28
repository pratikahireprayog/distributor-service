import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SmileHubopsService } from "./smile-hubops.service";
import { SmileHubopsAuthService } from "./smile-hubops-auth.service";
import { SchemaMapperModule } from "src/infrastructure/schema-mapper/schema-mapper.module";
import { BaseNetworkPartnerHelper } from "../../base/base-network-partner-helper.service";
import { OrderPartnerRepositoryModule } from "src/common/repositories/order-partner/order-partner.module";

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    EndpointConfigModule,
    SchemaMapperModule,
    OrderPartnerRepositoryModule,
  ],
  providers: [
    SmileHubopsService,
    SmileHubopsAuthService,
    BaseNetworkPartnerHelper,
  ],
  exports: [SmileHubopsService, SmileHubopsAuthService],
})
export class SmileHubopsModule {}

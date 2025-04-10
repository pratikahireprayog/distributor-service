import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { DefaultNetworkPartner } from "./default-network-partner.service";
import { DefaultAuthService } from "./default-auth.service";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { BaseNetworkPartnerHelper } from "../../base/base-network-partner-helper.service";
import { OrderPartnerRepositoryModule } from "src/common/repositories/order-partner/order-partner.module";

/**
 * Module for the default network partner
 */
@Module({
  imports: [HttpModule, EndpointConfigModule, OrderPartnerRepositoryModule],
  providers: [
    DefaultNetworkPartner,
    DefaultAuthService,
    SchemaMapperService,
    BaseNetworkPartnerHelper,
  ],
  exports: [
    DefaultNetworkPartner,
    DefaultAuthService,
    BaseNetworkPartnerHelper,
  ],
})
export class DefaultNetworkPartnerModule {}

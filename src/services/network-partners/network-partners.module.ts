import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NetworkPartnerFactoryService } from "./factory/network-partner-factory.service";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { networkPartnersProviders } from "./network-partners.provider";
import { BigshipModule } from "./implementation/bigship/bigship.module";
import { TsawModule } from "./implementation/tsaw/tsaw.module";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { DefaultNetworkPartnerModule } from "./implementation/default/default-network-partner.module";
import { ShipyaariModule } from "./implementation/shipyaari/shipyaari.module";
import { DHLModule } from "./implementation/dhl/dhl.module";
import { SmileHyperlocalModule } from "./implementation/smile-hyperlocal/smile-hyperlocal.module";
import { PorterModule } from "./implementation/porter/porter.module";
import { IndiaPostInternationalModule } from "./implementation/india-post-international/india-post-international.module";

/**
 * Module for network partners
 */
@Module({
  imports: [
    HttpModule,
    ConfigModule,
    BigshipModule,
    TsawModule,
    DefaultNetworkPartnerModule,
    EndpointConfigModule,
    ShipyaariModule,
    DHLModule,
    SmileHyperlocalModule,
    PorterModule,
    IndiaPostInternationalModule,
  ],
  providers: [
    NetworkPartnerFactoryService,
    ...networkPartnersProviders,
    SchemaMapperService,
  ],
  exports: [NetworkPartnerFactoryService, SchemaMapperService],
})
export class NetworkPartnersModule {}

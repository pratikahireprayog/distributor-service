import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SmileHubopsService } from "./smile-hubops.service";
import { SmileHubopsAuthService } from "./smile-hubops-auth.service";
import { SmileHubopsController } from "./smile-hubops.controller";
import { SchemaMapperModule } from "src/infrastructure/schema-mapper/schema-mapper.module";
import { BaseNetworkPartnerHelper } from "../../base/base-network-partner-helper.service";
import { OrderPartnerRepositoryModule } from "src/common/repositories/order-partner/order-partner.module";
import { AwbSeriesModule } from "src/common/repositories/awb-series/awb-series.module";
import { AwbSeriesAuditModule } from "src/common/repositories/awb-series-audit/awb-series-audit.module";
import { AwbSeriesService } from "./awb-series.service";
import { DiscordAlertService } from "src/infrastructure/alert/discord-alert.service";

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    EndpointConfigModule,
    SchemaMapperModule,
    OrderPartnerRepositoryModule,
    AwbSeriesModule,
    AwbSeriesAuditModule,
  ],
  controllers: [SmileHubopsController],
  providers: [
    SmileHubopsService,
    SmileHubopsAuthService,
    BaseNetworkPartnerHelper,
    AwbSeriesService,
    DiscordAlertService,
  ],
  exports: [SmileHubopsService, SmileHubopsAuthService, AwbSeriesService],
})
export class SmileHubopsModule {}

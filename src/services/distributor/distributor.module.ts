import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { OrderPartnerRepositoryModule } from "src/common/repositories/order-partner/order-partner.module";
import { NetworkPartnersModule } from "../network-partners/network-partners.module";
import { DistributorService } from "./distributor.service";
import { DiscordAlertService } from "../../infrastructure/alert/discord-alert.service";
import { PartnerServiceClient } from "src/common/services/partner-service.client";

/**
 * Module for distributor service
 */
@Module({
  imports: [ConfigModule, HttpModule, NetworkPartnersModule, OrderPartnerRepositoryModule],
  providers: [DistributorService, DiscordAlertService, PartnerServiceClient],
  exports: [DistributorService],
})
export class DistributorModule {}
